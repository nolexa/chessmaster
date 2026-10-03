import { beforeAll, describe, expect, it } from 'vitest';
import { makeMove, parseSan, replay, type Position } from '../src/chess';
import type { Engine } from '../src/engine';
import { commentOnMove, gameAccuracy, moveAccuracy, rateMove, toPgn, winPercent, type MoveRating } from '../src/review';
import { createNodeEngine } from './support/node-engine';

describe('accuracy', () => {
  it('maps evaluations to winning chances', () => {
    expect(winPercent(0)).toBeCloseTo(50, 5);
    expect(winPercent(300)).toBeGreaterThan(70);
    expect(winPercent(-300)).toBeLessThan(30);
    expect(winPercent(99_800)).toBeCloseTo(winPercent(1000), 5); // mates are capped
  });

  it('gives ~100% for keeping winning chances and less for losing them', () => {
    expect(moveAccuracy(60, 60)).toBeCloseTo(100, 0);
    expect(moveAccuracy(60, 70)).toBeCloseTo(100, 0); // improving never exceeds 100
    expect(moveAccuracy(60, 50)).toBeGreaterThan(55);
    expect(moveAccuracy(60, 50)).toBeLessThan(70);
    expect(moveAccuracy(80, 10)).toBeLessThan(5);
  });

  it('averages rated moves', () => {
    expect(gameAccuracy([100, 80, 60])).toBeCloseTo(80);
    expect(gameAccuracy([])).toBeNull();
  });
});

describe('comments and PGN', () => {
  const start = replay([]).positions[0];
  const e4 = makeMove(start, parseSan(start, 'e4'));
  const e5 = makeMove(e4.position, parseSan(e4.position, 'e5'));
  const h3Before = e5.position;
  const h3 = makeMove(h3Before, parseSan(h3Before, 'h3'));
  const rating: MoveRating = {
    grade: 'inaccuracy',
    accuracy: 72.4,
    bestCp: 40,
    scoreCp: -40,
    bestSan: 'Nf3',
    bestUci: 'g1f3',
    bestLine: ['Nf3', 'Nc6', 'Bb5'],
    reply: ['Nf6', 'Nc3'],
  };

  it('comments on book moves, deviations and rated moves', () => {
    expect(commentOnMove(start, e4.move, { book: { variations: ['Italian'] } })).toEqual([
      '1.e4 is a book move (Italian).',
    ]);
    const text = commentOnMove(h3Before, h3.move, {
      rating,
      deviation: { expected: [{ san: '2.Nf3', variations: ['Italian', 'Ruy Lopez'] }] },
    }).join(' ');
    expect(text).toContain('Here you left the book. The book continues with 2.Nf3 (Italian, Ruy Lopez).');
    expect(text).toContain('2.Nf3 was more precise');
    expect(text).toContain("The engine's answer: 2…Nf6 3.Nc3.");
    expect(text).toContain('Best line: 2.Nf3 Nc6 3.Bb5.');
    expect(commentOnMove(h3Before, h3.move, {})).toEqual(['Analysing…']);
  });

  it('writes PGN with headers, move numbers, NAGs and comments', () => {
    const moves: { move: typeof e4.move; before: Position; book?: boolean; rating?: MoveRating }[] = [
      { move: e4.move, before: start, book: true },
      { move: e5.move, before: e4.position, book: true },
      { move: h3.move, before: h3Before, rating },
    ];
    const pgn = toPgn(
      {
        event: 'Test',
        site: 'https://example.test',
        date: new Date(2026, 9, 3),
        white: 'You',
        black: 'Stockfish (1500)',
        result: '*',
        opening: 'Italian Game',
      },
      moves,
      'w',
    );
    expect(pgn).toContain('[Date "2026.10.03"]');
    expect(pgn).toContain('[Black "Stockfish (1500)"]');
    expect(pgn).toContain('1. e4 {Book} 1... e5 2. h3 $6 {Inaccuracy, −0.4, accuracy 72%. Best was Nf3.} *');
  });
});

describe('rating moves with Stockfish', () => {
  let engine: Engine;
  // Italian Game, Blackburne Shilling: 3...Nd4 instead of 3...Bc5.
  const shilling = replay('e4 e5 Nf3 Nc6 Bc4 Nd4'.split(' ')).positions[6];

  beforeAll(async () => {
    engine = await createNodeEngine();
  }, 60_000);

  it('rates the greedy 4.Nxe5? as a serious error and explains the refutation', async () => {
    const r = await rateMove(engine, shilling, parseSan(shilling, 'Nxe5'));
    expect(['mistake', 'blunder']).toContain(r.grade);
    expect(r.accuracy).toBeLessThan(60);
    expect(r.reply[0]).toBe('Qg5');
    expect(r.bestSan).not.toBe('Nxe5');
  }, 60_000);

  it('rates the engine’s own choice as best with ~100% accuracy', async () => {
    const first = await rateMove(engine, shilling, parseSan(shilling, 'Nxd4'));
    const best = await rateMove(engine, shilling, parseSan(shilling, first.bestSan));
    expect(best.grade).toBe('best');
    expect(best.accuracy).toBeGreaterThan(99);
  }, 60_000);
});
