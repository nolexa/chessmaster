import { describe, expect, it } from 'vitest';
import { legalMoves, parseUci, replay, toFen, toUci } from '../src/chess';
import { findOpening } from '../src/openings';
import { buildBook, bookMovesAt, outcomeFor, pickBookMove, resultText, strengthLabel } from '../src/play';
import { createNodeEngine } from './support/node-engine';

const italian = findOpening('italian')!;
const afterBc4 = replay('e4 e5 Nf3 Nc6 Bc4'.split(' ')).positions[5];

describe('opening book', () => {
  it('collects every variation’s move from a position', () => {
    const moves = bookMovesAt(buildBook(italian), afterBc4);
    expect(moves.map((m) => m.san).sort()).toEqual(['Bc5', 'Nf6']);
    const bc5 = moves.find((m) => m.san === 'Bc5')!;
    expect(bc5.variations).toContain('Giuoco Piano (Main Line)');
    expect(bc5.variations).toContain('Evans Gambit');
    expect(moves.find((m) => m.san === 'Nf6')!.variations).toEqual(['Two Knights: Ng5 Line']);
  });

  it('can be limited to one variation', () => {
    const twoKnights = italian.variations.findIndex((v) => v.name.startsWith('Two Knights'));
    expect(bookMovesAt(buildBook(italian, twoKnights), afterBc4).map((m) => m.san)).toEqual(['Nf6']);
  });

  it('is empty once the game leaves the opening', () => {
    const elsewhere = replay('d4 d5'.split(' ')).positions[2];
    expect(bookMovesAt(buildBook(italian), elsewhere)).toEqual([]);
  });

  it('picks moves in proportion to the variations that play them', () => {
    const moves = bookMovesAt(buildBook(italian), afterBc4);
    const bc5Share = moves.find((m) => m.san === 'Bc5')!.variations.length;
    const total = moves.reduce((n, m) => n + m.variations.length, 0);
    // rng values just below and above the Bc5 share select each move in turn.
    const first = moves[0];
    const firstShare = first.variations.length / total;
    expect(pickBookMove(moves, () => firstShare - 0.01)).toBe(first);
    expect(pickBookMove(moves, () => firstShare + 0.01)).toBe(moves[1]);
    expect(bc5Share).toBeGreaterThan(1);
    expect(pickBookMove([], () => 0.5)).toBeNull();
  });
});

describe('results and labels', () => {
  it('describes outcomes from the learner’s side', () => {
    const mate = { result: '1-0', reason: 'checkmate' } as const;
    expect(outcomeFor(mate, 'w')).toBe('win');
    expect(outcomeFor(mate, 'b')).toBe('loss');
    expect(resultText(mate, 'w')).toBe('You won by checkmate');
    expect(resultText(mate, 'b')).toBe('You lost by checkmate');
    expect(resultText({ result: '1/2-1/2', reason: 'stalemate' }, 'w')).toBe('Draw by stalemate');
    expect(resultText({ resigned: 'b' }, 'b')).toBe('You resigned');
  });

  it('labels strengths', () => {
    expect(strengthLabel(1320)).toBe('Casual player');
    expect(strengthLabel(1650)).toBe('Club player');
    expect(strengthLabel(3190)).toBe('Super grandmaster');
  });
});

describe('engine opponent', () => {
  it('plays a legal move at limited strength, then analyses at full strength again', async () => {
    const engine = await createNodeEngine();
    const fen = toFen(afterBc4);
    const weak = await engine.bestMove(fen, { movetime: 200, elo: 1320 });
    expect(weak).not.toBeNull();
    expect(() => parseUci(afterBc4, weak!)).not.toThrow();

    // Full-strength analysis afterwards still returns the strongest replies.
    const [best] = await engine.analyse(fen, { depth: 12 });
    expect(legalMoves(afterBc4).map(toUci)).toContain(best.pv[0]);

    // No legal move: checkmate.
    const mated = replay('f3 e5 g4 Qh4#'.split(' ')).positions[4];
    expect(await engine.bestMove(toFen(mated), { movetime: 100 })).toBeNull();
  }, 60_000);
});
