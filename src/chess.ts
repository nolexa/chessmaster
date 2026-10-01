// Small chess rules engine: replays SAN move lists, generates legal moves,
// and converts between SAN, UCI and FEN.
// Squares are indexed 0..63 as rank * 8 + file (a1 = 0, h8 = 63).

export type Color = 'w' | 'b';
/** Uppercase = white, lowercase = black (FEN letters). */
export type Piece = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type PieceType = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type Promotion = 'N' | 'B' | 'R' | 'Q';
type CastlingRight = 'K' | 'Q' | 'k' | 'q';

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  castling: Record<CastlingRight, boolean>;
  /** En passant target square, if the last move was a double pawn push. */
  ep: number | null;
  /** Plies since the last capture or pawn move (fifty-move rule). */
  halfmove: number;
  /** Starts at 1 and increments after Black's move. */
  fullmove: number;
}

/** A move as coordinates, before it is played. */
export interface MoveSpec {
  from: number;
  to: number;
  promo?: Promotion | null;
}

export interface Move extends MoveSpec {
  san: string;
  color: Color;
  captured: Piece | null;
  /** Whether the move gives check. */
  check: boolean;
}

export interface Line {
  positions: Position[];
  moves: Move[];
}

const FILES = 'abcdefgh';
const PROMOTIONS: Promotion[] = ['Q', 'R', 'B', 'N'];

export const fileOf = (i: number): number => i % 8;
export const rankOf = (i: number): number => Math.floor(i / 8);
export const squareName = (i: number): string => FILES[fileOf(i)] + (rankOf(i) + 1);
export const squareIndex = (s: string): number => (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
export const colorOf = (p: Piece | null): Color | null => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
export const isWhite = (p: Piece): boolean => p === p.toUpperCase();
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');
const typeOf = (p: Piece): PieceType => p.toUpperCase() as PieceType;
const pieceOf = (type: PieceType, color: Color): Piece => (color === 'w' ? type : type.toLowerCase()) as Piece;

export function initial(): Position {
  const board: (Piece | null)[] = new Array(64).fill(null);
  const back: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    board[f] = pieceOf(back[f], 'w');
    board[8 + f] = 'P';
    board[48 + f] = 'p';
    board[56 + f] = pieceOf(back[f], 'b');
  }
  return { board, turn: 'w', castling: { K: true, Q: true, k: true, q: true }, ep: null, halfmove: 0, fullmove: 1 };
}

// Does the piece on `from` attack `to`? (Pawns: diagonal captures only.)
function attacks(board: Position['board'], from: number, to: number): boolean {
  const p = board[from];
  if (!p || from === to) return false;
  const type = typeOf(p);
  const df = fileOf(to) - fileOf(from);
  const dr = rankOf(to) - rankOf(from);
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  switch (type) {
    case 'N': return adf * adr === 2;
    case 'K': return Math.max(adf, adr) === 1;
    case 'P': return adf === 1 && dr === (isWhite(p) ? 1 : -1);
    default: {
      const straight = df === 0 || dr === 0;
      const diagonal = adf === adr;
      if (type === 'R' && !straight) return false;
      if (type === 'B' && !diagonal) return false;
      if (type === 'Q' && !straight && !diagonal) return false;
      const step = Math.sign(dr) * 8 + Math.sign(df);
      for (let s = from + step; s !== to; s += step) if (board[s]) return false;
      return true;
    }
  }
}

function isAttacked(board: Position['board'], target: number, byColor: Color): boolean {
  for (let i = 0; i < 64; i++) {
    if (colorOf(board[i]) === byColor && attacks(board, i, target)) return true;
  }
  return false;
}

export function kingSquare(board: Position['board'], color: Color): number {
  return board.indexOf(pieceOf('K', color));
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  return isAttacked(pos.board, kingSquare(pos.board, color), other(color));
}

// Pseudo-legal reachability (ignores whether own king is left in check).
function canMove(pos: Position, from: number, to: number): boolean {
  const { board } = pos;
  const p = board[from];
  if (!p) return false;
  const color = colorOf(p);
  if (color !== pos.turn || colorOf(board[to]) === color) return false;
  const type = typeOf(p);
  const df = fileOf(to) - fileOf(from);
  const dr = rankOf(to) - rankOf(from);

  if (type === 'P') {
    const dir = color === 'w' ? 1 : -1;
    const startRank = color === 'w' ? 1 : 6;
    if (df === 0 && !board[to]) {
      if (dr === dir) return true;
      return dr === 2 * dir && rankOf(from) === startRank && !board[from + 8 * dir];
    }
    return Math.abs(df) === 1 && dr === dir && (!!board[to] || to === pos.ep);
  }

  if (type === 'K' && dr === 0 && Math.abs(df) === 2) {
    const home = color === 'w' ? 4 : 60;
    if (from !== home) return false;
    const kingside = df > 0;
    const right: CastlingRight = color === 'w' ? (kingside ? 'K' : 'Q') : (kingside ? 'k' : 'q');
    if (!pos.castling[right]) return false;
    const rookSq = kingside ? home + 3 : home - 4;
    if (board[rookSq] !== pieceOf('R', color)) return false;
    for (let s = Math.min(home, rookSq) + 1; s < Math.max(home, rookSq); s++) if (board[s]) return false;
    const step = kingside ? 1 : -1;
    const enemy = other(color);
    return [home, home + step, home + 2 * step].every((s) => !isAttacked(board, s, enemy));
  }

  return attacks(board, from, to);
}

function applyMove(pos: Position, from: number, to: number, promo: Promotion | null) {
  const board = pos.board.slice();
  const castling = { ...pos.castling };
  const p = board[from]!;
  const color = colorOf(p)!;
  const type = typeOf(p);
  let captured = board[to];
  let ep: number | null = null;

  if (type === 'P') {
    if (to === pos.ep && !board[to]) {
      const capSq = to + (color === 'w' ? -8 : 8);
      captured = board[capSq];
      board[capSq] = null;
    }
    if (Math.abs(to - from) === 16) ep = (from + to) / 2;
  }

  board[to] = promo ? pieceOf(promo, color) : p;
  board[from] = null;

  if (type === 'K') {
    if (color === 'w') castling.K = castling.Q = false;
    else castling.k = castling.q = false;
    if (Math.abs(to - from) === 2) {
      const kingside = to > from;
      const rookFrom = kingside ? from + 3 : from - 4;
      const rookTo = kingside ? from + 1 : from - 1;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = null;
    }
  }
  const rookCorners: Partial<Record<number, CastlingRight>> = { 0: 'Q', 7: 'K', 56: 'q', 63: 'k' };
  const lostFrom = rookCorners[from];
  const lostTo = rookCorners[to];
  if (lostFrom) castling[lostFrom] = false;
  if (lostTo) castling[lostTo] = false;

  const position: Position = {
    board,
    turn: other(color),
    castling,
    ep,
    halfmove: type === 'P' || captured ? 0 : pos.halfmove + 1,
    fullmove: color === 'b' ? pos.fullmove + 1 : pos.fullmove,
  };
  return { position, captured };
}

/** Is this fully legal (including promotion rules and king safety)? */
function isLegal(pos: Position, { from, to, promo = null }: MoveSpec): boolean {
  if (!canMove(pos, from, to)) return false;
  const pawn = typeOf(pos.board[from]!) === 'P';
  const lastRank = rankOf(to) === (pos.turn === 'w' ? 7 : 0);
  if (pawn && lastRank !== !!promo) return false;
  if (!pawn && promo) return false;
  return !inCheck(applyMove(pos, from, to, promo).position, pos.turn);
}

export function legalMoves(pos: Position): MoveSpec[] {
  const moves: MoveSpec[] = [];
  for (let from = 0; from < 64; from++) {
    const p = pos.board[from];
    if (!p || colorOf(p) !== pos.turn) continue;
    const promotes = typeOf(p) === 'P' && rankOf(from) === (pos.turn === 'w' ? 6 : 1);
    for (let to = 0; to < 64; to++) {
      if (promotes) {
        for (const promo of PROMOTIONS) if (isLegal(pos, { from, to, promo })) moves.push({ from, to, promo });
      } else if (isLegal(pos, { from, to })) {
        moves.push({ from, to });
      }
    }
  }
  return moves;
}

/** Standard algebraic notation for a legal move, including +/# suffix. */
export function toSan(pos: Position, spec: MoveSpec): string {
  const { from, to, promo = null } = spec;
  const p = pos.board[from]!;
  const type = typeOf(p);
  let san: string;

  if (type === 'K' && Math.abs(to - from) === 2) {
    san = to > from ? 'O-O' : 'O-O-O';
  } else {
    const capture = !!pos.board[to] || (type === 'P' && fileOf(from) !== fileOf(to));
    if (type === 'P') {
      san = (capture ? FILES[fileOf(from)] + 'x' : '') + squareName(to) + (promo ? '=' + promo : '');
    } else {
      // Disambiguate against other pieces of the same type that can reach `to`.
      const rivals = legalMoves(pos).filter(
        (m) => m.to === to && m.from !== from && pos.board[m.from] === p,
      );
      let disambig = '';
      if (rivals.length) {
        if (rivals.every((m) => fileOf(m.from) !== fileOf(from))) disambig = FILES[fileOf(from)];
        else if (rivals.every((m) => rankOf(m.from) !== rankOf(from))) disambig = String(rankOf(from) + 1);
        else disambig = squareName(from);
      }
      san = type + disambig + (capture ? 'x' : '') + squareName(to);
    }
  }

  const { position } = applyMove(pos, from, to, promo);
  if (inCheck(position)) san += legalMoves(position).length ? '+' : '#';
  return san;
}

/** Play a legal move given as coordinates. */
export function makeMove(pos: Position, spec: MoveSpec, san = toSan(pos, spec)): { position: Position; move: Move } {
  const promo = spec.promo ?? null;
  const { position, captured } = applyMove(pos, spec.from, spec.to, promo);
  return {
    position,
    move: { san, from: spec.from, to: spec.to, promo, captured, color: pos.turn, check: inCheck(position) },
  };
}

const SAN_RE = /^([NBRQK])?([a-h])?([1-8])?x?([a-h][1-8])(?:=?([NBRQ]))?$/;

/** Resolve a SAN move to coordinates. Throws if illegal or ambiguous. */
export function parseSan(pos: Position, san: string): MoveSpec {
  const clean = san.replace(/[+#!?]+$/, '');
  let candidates: MoveSpec[] = [];

  if (/^(O-O|0-0)(-O|-0)?$/.test(clean)) {
    const from = pos.turn === 'w' ? 4 : 60;
    candidates = [{ from, to: clean.length > 3 ? from - 2 : from + 2 }];
  } else {
    const m = SAN_RE.exec(clean);
    if (!m) throw new Error(`Cannot parse move "${san}"`);
    const type = (m[1] ?? 'P') as PieceType;
    const fromFile = m[2] ? m[2].charCodeAt(0) - 97 : null;
    const fromRank = m[3] ? Number(m[3]) - 1 : null;
    const to = squareIndex(m[4]);
    const promo = (m[5] as Promotion | undefined) ?? null;
    for (let i = 0; i < 64; i++) {
      const p = pos.board[i];
      if (!p || typeOf(p) !== type || colorOf(p) !== pos.turn) continue;
      if (fromFile !== null && fileOf(i) !== fromFile) continue;
      if (fromRank !== null && rankOf(i) !== fromRank) continue;
      candidates.push({ from: i, to, promo });
    }
  }

  const legal = candidates.filter((c) => isLegal(pos, c));
  if (legal.length !== 1) {
    const side = pos.turn === 'w' ? 'White' : 'Black';
    throw new Error(`${legal.length ? 'Ambiguous' : 'Illegal'} move "${san}" for ${side}`);
  }
  return legal[0];
}

/** Play a SAN move, keeping the SAN text as written (annotations included). */
export function play(pos: Position, san: string): { position: Position; move: Move } {
  return makeMove(pos, parseSan(pos, san), san);
}

/** Replay a whole line: returns positions[0..n] and moves[0..n-1]. */
export function replay(sans: string[]): Line {
  const positions = [initial()];
  const moves: Move[] = [];
  sans.forEach((san, i) => {
    try {
      const r = play(positions[positions.length - 1], san);
      positions.push(r.position);
      moves.push(r.move);
    } catch (e) {
      (e as Error).message += ` (ply ${i + 1})`;
      throw e;
    }
  });
  return { positions, moves };
}

// ── UCI & FEN ──────────────────────────────────────────────────────────

export const toUci = ({ from, to, promo }: MoveSpec): string =>
  squareName(from) + squareName(to) + (promo ? promo.toLowerCase() : '');

/** Parse a UCI move (e.g. "e2e4", "e7e8q") and check it is legal. */
export function parseUci(pos: Position, uci: string): MoveSpec {
  const spec: MoveSpec = {
    from: squareIndex(uci.slice(0, 2)),
    to: squareIndex(uci.slice(2, 4)),
    promo: uci.length > 4 ? (uci[4].toUpperCase() as Promotion) : null,
  };
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci) || !isLegal(pos, spec)) {
    throw new Error(`Illegal UCI move "${uci}"`);
  }
  return spec;
}

/** Convert a UCI principal variation to SAN moves. Stops at the first illegal move. */
export function uciLineToSan(pos: Position, ucis: string[]): string[] {
  const sans: string[] = [];
  let current = pos;
  for (const uci of ucis) {
    try {
      const r = makeMove(current, parseUci(current, uci));
      sans.push(r.move.san);
      current = r.position;
    } catch {
      break;
    }
  }
  return sans;
}

export function toFen(pos: Position): string {
  const rows: string[] = [];
  for (let r = 7; r >= 0; r--) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.board[r * 8 + f];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += p;
    }
    rows.push(row + (empty || ''));
  }
  const castling = (['K', 'Q', 'k', 'q'] as const).filter((c) => pos.castling[c]).join('') || '-';
  const ep = pos.ep === null ? '-' : squareName(pos.ep);
  return `${rows.join('/')} ${pos.turn} ${castling} ${ep} ${pos.halfmove} ${pos.fullmove}`;
}

export function fromFen(fen: string): Position {
  const [placement, turn, castling, ep, halfmove = '0', fullmove = '1'] = fen.trim().split(/\s+/);
  const board: (Piece | null)[] = new Array(64).fill(null);
  placement.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else board[(7 - i) * 8 + f++] = ch as Piece;
    }
  });
  return {
    board,
    turn: turn as Color,
    castling: { K: castling.includes('K'), Q: castling.includes('Q'), k: castling.includes('k'), q: castling.includes('q') },
    ep: ep === '-' ? null : squareIndex(ep),
    halfmove: Number(halfmove),
    fullmove: Number(fullmove),
  };
}

/** FEN without move counters: identifies a position regardless of how it was reached. */
export const positionKey = (pos: Position): string => toFen(pos).split(' ').slice(0, 4).join(' ');

/** Move number prefix for SAN display: "4." for White, "4…" for Black. */
export const moveNumber = (pos: Position): string => `${pos.fullmove}${pos.turn === 'w' ? '.' : '…'}`;
