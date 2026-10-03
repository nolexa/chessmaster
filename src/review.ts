// Game review: rate the player's moves with the engine, comment on them,
// and record the game as annotated PGN.
import {
  makeMove,
  moveNumber,
  toFen,
  toUci,
  uciLineToSan,
  type Color,
  type Move,
  type MoveSpec,
  type Position,
} from './chess';
import { scoreToCp, type Engine } from './engine';
import { explainMove, formatLine, formatScore, grade, type Grade } from './quiz';

/** Search depth for rating a move: a little shallower than quiz answers, to keep up with play. */
export const REVIEW_DEPTH = 14;

// ── Accuracy (the formula Lichess publishes) ───────────────────────────

/** Winning chances (0–100) for the side to move, from a centipawn evaluation. */
export function winPercent(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/** Accuracy (0–100) of a move that changed winning chances from `before` to `after`. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter);
  const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, raw));
}

/** Overall accuracy: the mean of the rated moves' accuracies, or null if none are rated. */
export function gameAccuracy(accuracies: number[]): number | null {
  if (!accuracies.length) return null;
  return accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
}

// ── Rating a move ──────────────────────────────────────────────────────

export interface MoveRating {
  grade: Grade;
  accuracy: number;
  /** Evaluations after the best move and after the move played (centipawns, player's view). */
  bestCp: number;
  scoreCp: number;
  /** The engine's best move from the position before (SAN), and its line. */
  bestSan: string;
  bestUci: string;
  bestLine: string[];
  /** How the engine would continue after the move played (SAN, opponent first). */
  reply: string[];
}

/** Rate `move` played from `before` with a full-strength engine. */
export async function rateMove(engine: Engine, before: Position, move: MoveSpec): Promise<MoveRating> {
  const fen = toFen(before);
  const uci = toUci(move);
  const lines = await engine.analyse(fen, { depth: REVIEW_DEPTH, multiPv: 3 });
  let played = lines.find((l) => l.pv[0] === uci);
  if (!played) [played] = await engine.analyse(fen, { depth: REVIEW_DEPTH, searchMoves: [uci] });

  const bestCp = scoreToCp(lines[0].score);
  const scoreCp = played ? scoreToCp(played.score) : bestCp;
  const after = makeMove(before, move).position;
  const bestLine = uciLineToSan(before, lines[0].pv.slice(0, 6));
  return {
    grade: grade(bestCp, scoreCp, uci === lines[0].pv[0]),
    accuracy: moveAccuracy(winPercent(bestCp), winPercent(scoreCp)),
    bestCp,
    scoreCp,
    bestSan: bestLine[0] ?? '',
    bestUci: lines[0].pv[0],
    bestLine,
    reply: played ? uciLineToSan(after, played.pv.slice(1, 6)) : [],
  };
}

// ── Comments ───────────────────────────────────────────────────────────

/** Annotation symbol shown after a rated move. */
export const GRADE_MARK: Record<Grade, string> = { best: '', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

export const GRADE_LABEL: Record<Grade, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export interface BookInfo {
  /** Variations of the chosen opening that play this move. */
  variations: string[];
}

export interface DeviationInfo {
  /** Book moves that were available instead (numbered SAN, with variation names). */
  expected: { san: string; variations: string[] }[];
}

/** Paragraphs commenting on one of the player's moves. */
export function commentOnMove(
  before: Position,
  move: Move,
  info: { book?: BookInfo; rating?: MoveRating; deviation?: DeviationInfo },
): string[] {
  const played = `${moveNumber(before)}${move.san}`;
  if (info.book) {
    const lines = info.book.variations;
    return [`${played} is a book move${lines.length ? ` (${lines.join(', ')})` : ''}.`];
  }
  const parts: string[] = [];
  if (info.deviation?.expected.length) {
    const alts = info.deviation.expected.map((e) => `${e.san} (${e.variations.join(', ')})`).join(' or ');
    parts.push(`Here you left the book. The book continues with ${alts}.`);
  }
  const r = info.rating;
  if (!r) return [...parts, 'Analysing…'];

  const { meaning, comparison } = explainMove({
    grade: r.grade,
    bestCp: r.bestCp,
    scoreCp: r.scoreCp,
    played,
    best: `${moveNumber(before)}${r.bestSan}`,
    context: 'game',
  });
  parts.push(meaning, comparison);
  if (r.grade !== 'best' && r.grade !== 'good' && r.reply.length) {
    const after = makeMove(before, move).position;
    parts.push(`The engine's answer: ${formatLine(after, r.reply.slice(0, 4))}.`);
  }
  if (r.grade !== 'best' && r.bestLine.length > 1) {
    parts.push(`Best line: ${formatLine(before, r.bestLine.slice(0, 5))}.`);
  }
  return parts;
}

// ── PGN ────────────────────────────────────────────────────────────────

const NAG: Record<Grade, string> = { best: '', good: '', inaccuracy: ' $6', mistake: ' $2', blunder: ' $4' };

export interface PgnMove {
  move: Move;
  /** Position the move was played from. */
  before: Position;
  book?: boolean;
  rating?: MoveRating;
}

export interface PgnHeaders {
  event: string;
  site: string;
  date: Date;
  white: string;
  black: string;
  result: string;
  opening: string;
}

const pgnEscape = (s: string) => s.replace(/[{}]/g, '');

/** The game as PGN, with grades as NAGs and short comments on the player's moves. */
export function toPgn(headers: PgnHeaders, moves: PgnMove[], player: Color): string {
  const d = headers.date;
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const tags = [
    ['Event', headers.event],
    ['Site', headers.site],
    ['Date', date],
    ['White', headers.white],
    ['Black', headers.black],
    ['Result', headers.result],
    ['Opening', headers.opening],
  ]
    .map(([k, v]) => `[${k} "${v.replace(/"/g, "'")}"]`)
    .join('\n');

  const tokens: string[] = [];
  moves.forEach(({ move, before, book, rating }, i) => {
    if (before.turn === 'w') tokens.push(`${before.fullmove}.`);
    else if (i === 0) tokens.push(`${before.fullmove}...`);
    let token = move.san + (rating ? NAG[rating.grade] : '');
    if (move.color === player) {
      if (book) token += ' {Book}';
      else if (rating) {
        const note = rating.grade === 'best' || rating.grade === 'good' ? '' : ` Best was ${rating.bestSan}.`;
        token += ` {${GRADE_LABEL[rating.grade]}, ${formatScore(rating.scoreCp)}, accuracy ${Math.round(rating.accuracy)}%.${pgnEscape(note)}}`;
      }
    }
    tokens.push(token);
    // After a comment, Black's move needs its number repeated.
    if (move.color === 'w' && token.includes('{') && moves[i + 1]) tokens.push(`${before.fullmove}...`);
  });
  tokens.push(headers.result);

  // Wrap movetext at about 80 characters.
  const lines: string[] = [];
  let line = '';
  for (const t of tokens.join(' ').split(' ')) {
    if (line && line.length + t.length + 1 > 80) {
      lines.push(line);
      line = t;
    } else line = line ? `${line} ${t}` : t;
  }
  if (line) lines.push(line);
  return `${tags}\n\n${lines.join('\n')}\n`;
}
