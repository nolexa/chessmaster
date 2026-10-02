import { describe, expect, it } from 'vitest';
import { fromFen, gameEnd, initial, insufficientMaterial, legalMoves, makeMove, parseSan, parseUci, replay, squareIndex, toFen, toSan, uciLineToSan } from '../src/chess';

const moves = (line: string) => line.split(' ');

describe('chess engine', () => {
  it('captures en passant', () => {
    const { positions } = replay(moves('e4 a6 e5 d5 exd6'));
    const final = positions.at(-1)!;
    expect(final.board[squareIndex('d6')]).toBe('P');
    expect(final.board[squareIndex('d5')]).toBeNull();
  });

  it('castles both sides and moves the rook', () => {
    const { positions } = replay(moves('e4 d5 Nf3 Qd6 Bc4 Bd7 O-O Nc6 d3 O-O-O'));
    const b = positions.at(-1)!.board;
    expect([b[squareIndex('g1')], b[squareIndex('f1')]]).toEqual(['K', 'R']);
    expect([b[squareIndex('c8')], b[squareIndex('d8')]]).toEqual(['k', 'r']);
  });

  it('promotes pawns', () => {
    const { positions } = replay(moves('h4 g5 hxg5 Nf6 gxf6 Bg7 fxg7 Rf8 gxf8=Q+'));
    expect(positions.at(-1)!.board[squareIndex('f8')]).toBe('Q');
  });

  it('resolves disambiguation by pin', () => {
    // Black's c6-knight is pinned by Bb5, so "Ne7" can only mean the g8-knight.
    const { moves: played } = replay(moves('e4 e5 Nf3 Nc6 Bb5 d6 Nc3 Ne7'));
    expect(played.at(-1)!.from).toBe(squareIndex('g8'));
  });

  it('rejects castling out of check', () => {
    expect(() => replay(moves('e4 e5 Bc4 Bc5 Nf3 Qh4 Nxh4 Bxf2+ O-O'))).toThrow(/Illegal/);
  });

  it('rejects moving a king next to the enemy king', () => {
    const line = 'e4 d5 exd5 e6 dxe6 Ke7 Ke2 Kxe6 Ke3 Kf5';
    expect(() => replay(moves(line))).not.toThrow();
    expect(() => replay(moves(`${line} Ke4`))).toThrow(/Illegal/);
  });

  it('rejects ambiguous moves', () => {
    expect(() => replay(moves('Nf3 Nf6 Nc3 Nc6 Nb5 a6 Nd4'))).toThrow(/Ambiguous/);
  });

  it('detects check', () => {
    const { moves: played } = replay(moves('e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#'));
    expect(played.at(-1)!.check).toBe(true);
  });
});

function perft(pos: ReturnType<typeof initial>, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  return moves.reduce((n, m) => n + perft(makeMove(pos, m, '').position, depth - 1), 0);
}

describe('move generation (perft)', () => {
  it('matches the starting position counts', () => {
    expect([1, 2, 3].map((d) => perft(initial(), d))).toEqual([20, 400, 8902]);
  });

  it('handles castling, pins, en passant and promotion ("Kiwipete")', () => {
    const pos = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect([1, 2].map((d) => perft(pos, d))).toEqual([48, 2039]);
  });

  it('handles discovered checks and en passant pins', () => {
    const pos = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect([1, 2, 3].map((d) => perft(pos, d))).toEqual([14, 191, 2812]);
  });

  it('handles promotions with check', () => {
    const pos = fromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect([1, 2].map((d) => perft(pos, d))).toEqual([6, 264]);
  });
});

describe('notation', () => {
  it('writes SAN with disambiguation, captures, castling and mate', () => {
    const line = replay(moves('e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3 Bc5 d3 d6 Bg5 h6 O-O'));
    expect(line.moves.map((m, i) => toSan(line.positions[i], m))).toEqual(
      moves('e4 e5 Nf3 Nc6 Bc4 Nf6 Nc3 Bc5 d3 d6 Bg5 h6 O-O'),
    );
    const knights = fromFen('4k3/8/8/8/8/8/8/N3K1N1 w - - 0 1');
    expect(toSan(knights, parseUci(knights, 'a1b3'))).toBe('Nb3');
    const rooks = fromFen('4k3/8/8/8/8/8/4K3/R6R w - - 0 1');
    expect(toSan(rooks, parseUci(rooks, 'a1d1'))).toBe('Rad1');
    const mate = replay(moves('e4 e5 Bc4 Nc6 Qh5 Nf6'));
    const pos = mate.positions.at(-1)!;
    expect(toSan(pos, parseUci(pos, 'h5f7'))).toBe('Qxf7#');
  });

  it('round-trips FEN', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    expect(toFen(fromFen(fen))).toBe(fen);
    const afterE4 = replay(['e4']).positions[1];
    expect(toFen(afterE4)).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  });

  it('converts UCI lines to SAN', () => {
    expect(uciLineToSan(initial(), ['e2e4', 'e7e5', 'g1f3', 'zzzz', 'b8c6'])).toEqual(['e4', 'e5', 'Nf3']);
    expect(() => parseUci(initial(), 'e2e5')).toThrow(/Illegal/);
  });

  it('requires a promotion piece on the last rank', () => {
    const pos = fromFen('8/P3k3/8/8/8/8/8/4K3 w - - 0 1');
    expect(() => parseSan(pos, 'a8')).toThrow(/Illegal/);
    expect(toSan(pos, parseSan(pos, 'a8=N'))).toBe('a8=N');
  });
});

describe('game end', () => {
  const history = (line: string) => replay(line ? moves(line) : []).positions;

  it('detects checkmate and who won', () => {
    expect(gameEnd(history('f3 e5 g4 Qh4#'))).toEqual({ result: '0-1', reason: 'checkmate' });
    expect(gameEnd(history('e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#'))).toEqual({ result: '1-0', reason: 'checkmate' });
  });

  it('detects stalemate', () => {
    expect(gameEnd([fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')])).toEqual({ result: '1/2-1/2', reason: 'stalemate' });
  });

  it('detects threefold repetition', () => {
    const shuffle = 'Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8';
    expect(gameEnd(history(shuffle.split(' ').slice(0, 7).join(' ')))).toBeNull();
    expect(gameEnd(history(shuffle))).toEqual({ result: '1/2-1/2', reason: 'repetition' });
  });

  it('detects the fifty-move rule and insufficient material', () => {
    expect(gameEnd([fromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 100 80')])).toEqual({ result: '1/2-1/2', reason: 'fifty-move' });
    expect(gameEnd([fromFen('4k3/8/8/8/8/8/8/4KN2 w - - 0 1')])).toEqual({ result: '1/2-1/2', reason: 'insufficient-material' });
    // f1 and c4 are both light squares; c5 is dark.
    expect(insufficientMaterial(fromFen('4k3/8/8/8/2b5/8/8/4KB2 w - - 0 1'))).toBe(true);
    expect(insufficientMaterial(fromFen('4k3/8/8/2b5/8/8/8/4KB2 w - - 0 1'))).toBe(false);
    expect(insufficientMaterial(fromFen('4k3/8/8/8/8/8/8/4KR2 w - - 0 1'))).toBe(false);
    expect(gameEnd(history(''))).toBeNull();
  });
});
