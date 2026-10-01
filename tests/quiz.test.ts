import { beforeAll, describe, expect, it } from 'vitest';
import { initial, replay, toUci } from '../src/chess';
import type { Engine } from '../src/engine';
import { OPENINGS, findOpening, openingsFor } from '../src/openings';
import {
  acceptedAnswers,
  annotation,
  buildQuiz,
  bookMovesAt,
  createQuiz,
  describeEval,
  deviationPlies,
  explainVerdict,
  materialEquivalent,
  deviationWeight,
  formatLine,
  formatScore,
  grade,
  judge,
  specFromSan,
  type Quiz,
} from '../src/quiz';
import { createNodeEngine } from './support/node-engine';

/** Deterministic PRNG so quizzes are reproducible. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('grading', () => {
  it('accepts the top move and near-equal alternatives', () => {
    expect(grade(50, 50, true)).toBe('best');
    expect(grade(50, 25, false)).toBe('good');
    expect(grade(50, -20, false)).toBe('inaccuracy');
    expect(grade(50, -150, false)).toBe('mistake');
    expect(grade(50, -400, false)).toBe('blunder');
  });

  it('accepts any decisive continuation when already winning', () => {
    expect(grade(99_700, 800, false)).toBe('good');
    expect(grade(900, 300, false)).toBe('blunder');
  });

  it('annotates and weights deviations by their cost', () => {
    expect([10, 50, 150, 400].map(annotation)).toEqual(['', '?!', '?', '??']);
    expect(deviationWeight(150)).toBeGreaterThan(deviationWeight(10));
    expect(deviationWeight(150)).toBeGreaterThan(deviationWeight(900));
  });
});

describe('deviation points', () => {
  it('only lets the opponent deviate after the first moves', () => {
    for (const opening of OPENINGS) {
      for (const variation of opening.variations) {
        const { moves } = replay(variation.moves.split(' '));
        const plies = deviationPlies(moves, opening.side);
        expect(plies.length, `${opening.name}: ${variation.name}`).toBeGreaterThan(0);
        for (const ply of plies) {
          expect(ply).toBeGreaterThanOrEqual(2);
          expect(moves[ply].color).not.toBe(opening.side);
        }
      }
    }
  });
});

describe('explanations', () => {
  it('describes evaluations in words, from the learner’s side', () => {
    expect(describeEval(10)).toBe('the position is about equal');
    expect(describeEval(60)).toBe('you are slightly better');
    expect(describeEval(-180)).toBe('your opponent is clearly better');
    expect(describeEval(450)).toBe('you are winning');
    expect(describeEval(99_800)).toBe('you have a forced mate');
    expect(describeEval(-99_800)).toBe('your opponent has a forced mate');
  });

  it('translates lost advantage into material', () => {
    expect(materialEquivalent(50)).toBe('less than a pawn');
    expect(materialEquivalent(320)).toBe('about a knight or bishop');
    expect(materialEquivalent(900)).toBe('more than a rook');
  });
});

describe('formatting', () => {
  it('numbers moves from any position', () => {
    expect(formatLine(initial(), ['e4', 'e5', 'Nf3'])).toBe('1.e4 e5 2.Nf3');
    const afterE4 = replay(['e4']).positions[1];
    expect(formatLine(afterE4, ['c5', 'Nf3', 'd6'])).toBe('1…c5 2.Nf3 d6');
  });

  it('formats scores in pawns and mates', () => {
    expect([123, -40, 0, 99_700, -99_800].map(formatScore)).toEqual(['+1.2', '−0.4', '0.0', 'M3', '−M2']);
  });
});

describe('book index', () => {
  it('knows every book move from a position, across openings', () => {
    const afterBc4 = replay('e4 e5 Nf3 Nc6 Bc4'.split(' ')).positions[5];
    const moves = bookMovesAt(afterBc4);
    expect(moves.has('f8c5')).toBe(true); // Giuoco Piano
    expect(moves.has('g8f6')).toBe(true); // Two Knights
    expect(moves.has('d8h4')).toBe(false);
  });
});

describe('quizzes with Stockfish', () => {
  let engine: Engine;
  let quiz: Quiz;

  beforeAll(async () => {
    engine = await createNodeEngine();
    quiz = await createQuiz(engine, [findOpening('italian')!], seeded(7));
  }, 60_000);

  it('deviates from the book on an opponent move', () => {
    expect(quiz.learner).toBe('w');
    expect(quiz.deviation.color).toBe('b');
    expect(quiz.position.turn).toBe('w');
    expect(bookMovesAt(quiz.before).has(toUci(quiz.deviation))).toBe(false);
    expect(quiz.answers.length).toBeGreaterThan(0);
  });

  it('marks the engine’s top move correct', async () => {
    const best = acceptedAnswers(quiz)[0].san[0];
    const verdict = await judge(engine, quiz, specFromSan(quiz, best));
    expect(verdict.grade).toBe('best');
    expect(verdict.correct).toBe(true);
  }, 60_000);

  it('punishes the classic trap reply and accepts the sound one', async () => {
    // Italian Game, Black's 3rd move: the Blackburne Shilling 3...Nd4?! instead of 3...Bc5.
    const shilling = await buildQuiz(engine, findOpening('italian')!, 0, 5, 'c6d4');
    expect(shilling.deviation.san).toBe('Nd4');
    expect(shilling.history.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);

    // 4.Nxe5? grabs a pawn but runs into 4...Qg5!, hitting the knight and g2.
    const greedy = await judge(engine, shilling, specFromSan(shilling, 'Nxe5'));
    expect(greedy.correct).toBe(false);
    expect(['mistake', 'blunder']).toContain(greedy.grade);
    expect(greedy.continuation[0]).toBe('Qg5');

    const why = explainVerdict(shilling, greedy, '4.Nxd4');
    expect(why.meaning).toMatch(/gives away \d+\.\d pawns of advantage/);
    expect(why.comparison).toMatch(/^With the best move, .+\. After 4\.Nxe5, .+\.$/);

    // Trading on d4 is a solid, correct answer.
    const sound = await judge(engine, shilling, specFromSan(shilling, 'Nxd4'));
    expect(sound.correct).toBe(true);
    expect(explainVerdict(shilling, sound, '4.Nxd4').meaning.length).toBeGreaterThan(0);
  }, 60_000);

  it('builds quizzes for Black openings too', async () => {
    const q = await createQuiz(engine, openingsFor('b'), seeded(3));
    expect(q.learner).toBe('b');
    expect(q.deviation.color).toBe('w');
    expect(OPENINGS).toContain(q.opening);
  }, 60_000);
});
