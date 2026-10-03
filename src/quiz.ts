// Deviation quizzes: replay a book line, let the opponent leave the book with a
// plausible (often inferior) move, and ask the learner for the best reply.
import {
  initial,
  makeMove,
  moveNumber,
  parseSan,
  parseUci,
  positionKey,
  replay,
  toFen,
  toUci,
  uciLineToSan,
  type Color,
  type Move,
  type MoveSpec,
  type Position,
} from './chess';
import { scoreToCp, type Engine, type PvLine } from './engine';
import { OPENINGS, sanList, type Opening } from './openings';

/** Search depths: candidate scan is wide but shallow; answers are narrow and deep. */
export const DEPTH = { candidates: 10, answers: 16 } as const;
const ANSWER_LINES = 5;

export interface Quiz {
  opening: Opening;
  variationIndex: number;
  learner: Color;
  /** Book moves played before the deviation. */
  history: Move[];
  /** Position before the opponent's deviation. */
  before: Position;
  /** The book move the opponent should have played. */
  bookMove: Move;
  /** The move the opponent actually played. */
  deviation: Move;
  /** Centipawns the deviation gives away compared with the opponent's best move. */
  deviationCost: number;
  /** Position after the deviation, learner to move. */
  position: Position;
  /** Engine's best replies for the learner, best first. */
  answers: PvLine[];
}

export type Grade = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface Verdict {
  move: Move;
  grade: Grade;
  correct: boolean;
  /** Learner's evaluation after their move, in centipawns. */
  score: number;
  /** Centipawns lost compared with the best reply. */
  loss: number;
  /** Engine's continuation after the learner's move (SAN). */
  continuation: string[];
}

type Rng = () => number;

const pick = <T>(items: T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

function weightedPick<T>(items: T[], weight: (item: T) => number, rng: Rng): T {
  const weights = items.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * How likely a deviation is to be chosen, by how much it costs the opponent.
 * Favour real mistakes (there is something to punish) over equal alternatives,
 * and keep gross blunders (hanging a queen) rare.
 */
export function deviationWeight(cost: number): number {
  if (cost < 25) return 1;
  if (cost < 80) return 2;
  if (cost < 250) return 4;
  if (cost < 600) return 2;
  return 0.5;
}

/** Conventional annotation for a move that costs `cost` centipawns. */
export function annotation(cost: number): string {
  if (cost < 25) return '';
  if (cost < 80) return '?!';
  if (cost < 250) return '?';
  return '??';
}

/** Every move any book line plays from each position (keyed without move counters). */
let bookIndex: Map<string, Set<string>> | null = null;

export function bookMovesAt(pos: Position): Set<string> {
  if (!bookIndex) {
    bookIndex = new Map();
    for (const opening of OPENINGS) {
      for (const variation of opening.variations) {
        const { positions, moves } = replay(sanList(variation));
        moves.forEach((m, i) => {
          const key = positionKey(positions[i]);
          if (!bookIndex!.has(key)) bookIndex!.set(key, new Set());
          bookIndex!.get(key)!.add(toUci(m));
        });
      }
    }
  }
  return bookIndex.get(positionKey(pos)) ?? new Set();
}

/**
 * Plies where the opponent may leave the book. Both sides' first moves are
 * skipped: a different first move is a different opening, not a deviation.
 */
export function deviationPlies(moves: Move[], learner: Color): number[] {
  return moves.map((m, i) => (m.color !== learner && i >= 2 ? i : -1)).filter((i) => i >= 0);
}

/** Build a random quiz from one of `openings` (all for the same learner side). */
export async function createQuiz(engine: Engine, openings: Opening[], rng: Rng = Math.random): Promise<Quiz> {
  const opening = pick(openings, rng);
  const variationIndex = Math.floor(rng() * opening.variations.length);
  const { positions, moves } = replay(sanList(opening.variations[variationIndex]));

  const ply = pick(deviationPlies(moves, opening.side), rng);
  const before = positions[ply];
  const book = bookMovesAt(before);

  // Score every legal move for the opponent, then pick a non-book one.
  const candidates = await engine.analyse(toFen(before), { depth: DEPTH.candidates, multiPv: 256 });
  const best = scoreToCp(candidates[0].score);
  const options = candidates
    // Skip book moves, and mating attacks: a deviation should leave something to answer.
    .filter((c) => !book.has(c.pv[0]) && !(c.score.type === 'mate' && c.score.value > 0))
    .map((c) => ({ uci: c.pv[0], cost: Math.max(0, best - scoreToCp(c.score)) }));
  if (!options.length) throw new Error('No non-book moves available');
  const choice = weightedPick(options, (o) => deviationWeight(o.cost), rng);

  return buildQuiz(engine, opening, variationIndex, ply, choice.uci, choice.cost);
}

/**
 * Build the quiz where the opponent plays `deviationUci` instead of the book
 * move at `ply` of the given variation.
 */
export async function buildQuiz(
  engine: Engine,
  opening: Opening,
  variationIndex: number,
  ply: number,
  deviationUci: string,
  deviationCost?: number,
): Promise<Quiz> {
  const { positions, moves } = replay(sanList(opening.variations[variationIndex]));
  const before = positions[ply];
  const { position, move: deviation } = makeMove(before, parseUci(before, deviationUci));

  if (deviationCost === undefined) {
    const [best] = await engine.analyse(toFen(before), { depth: DEPTH.candidates });
    const [played] = await engine.analyse(toFen(before), { depth: DEPTH.candidates, searchMoves: [deviationUci] });
    deviationCost = Math.max(0, scoreToCp(best.score) - scoreToCp(played.score));
  }
  const answers = await engine.analyse(toFen(position), { depth: DEPTH.answers, multiPv: ANSWER_LINES });

  return {
    opening,
    variationIndex,
    learner: opening.side,
    history: moves.slice(0, ply),
    before,
    bookMove: moves[ply],
    deviation,
    deviationCost,
    position,
    answers,
  };
}

/** Moves that lose at most this much (in centipawns) still count as correct. */
export function tolerance(bestCp: number): number {
  return Math.min(100, 30 + Math.abs(bestCp) * 0.1);
}

/** Upper bounds (centipawns lost) for each wrong-answer grade. */
export const LOSS_LIMIT = { inaccuracy: 100, mistake: 250 } as const;
/** From this advantage on, any move that keeps it counts as good. */
export const DECISIVE = 600;

export function grade(bestCp: number, scoreCp: number, isTopMove: boolean): Grade {
  const loss = bestCp - scoreCp;
  if (isTopMove || loss <= 0) return 'best';
  // In a decisively winning position, any move that keeps a decisive edge is fine.
  if (loss <= tolerance(bestCp) || (bestCp >= DECISIVE && scoreCp >= DECISIVE)) return 'good';
  if (loss <= LOSS_LIMIT.inaccuracy) return 'inaccuracy';
  if (loss <= LOSS_LIMIT.mistake) return 'mistake';
  return 'blunder';
}

/** Evaluate the learner's reply against the engine's best. */
export async function judge(engine: Engine, quiz: Quiz, spec: MoveSpec): Promise<Verdict> {
  const uci = toUci(spec);
  let line = quiz.answers.find((a) => a.pv[0] === uci);
  if (!line) {
    [line] = await engine.analyse(toFen(quiz.position), { depth: DEPTH.answers, searchMoves: [uci] });
  }
  const { position, move } = makeMove(quiz.position, spec);
  const bestCp = scoreToCp(quiz.answers[0].score);
  const scoreCp = line ? scoreToCp(line.score) : bestCp;
  const g = grade(bestCp, scoreCp, uci === quiz.answers[0].pv[0]);
  return {
    move,
    grade: g,
    correct: g === 'best' || g === 'good',
    score: scoreCp,
    loss: Math.max(0, bestCp - scoreCp),
    continuation: line ? uciLineToSan(position, line.pv.slice(1)) : [],
  };
}

/** Engine lines that count as correct answers, as SAN sequences. */
export function acceptedAnswers(quiz: Quiz): { san: string[]; score: number }[] {
  const bestCp = scoreToCp(quiz.answers[0].score);
  return quiz.answers
    .filter((a, i) => {
      const g = grade(bestCp, scoreToCp(a.score), i === 0);
      return g === 'best' || g === 'good';
    })
    .map((a) => ({ san: uciLineToSan(quiz.position, a.pv), score: scoreToCp(a.score) }));
}

/** SAN moves played from `pos`, each with its move-number prefix ("4.", "4…" or ""). */
export function numberedMoves(pos: Position, sans: string[]): { prefix: string; san: string }[] {
  let fullmove = pos.fullmove;
  let turn = pos.turn;
  return sans.map((san, i) => {
    const prefix = turn === 'w' ? `${fullmove}.` : i === 0 ? `${fullmove}…` : '';
    if (turn === 'b') fullmove++;
    turn = turn === 'w' ? 'b' : 'w';
    return { prefix, san };
  });
}

/** "4.Nxe5 Qg5 5.Nxf7" style text for SAN moves played from `pos`. */
export function formatLine(pos: Position, sans: string[]): string {
  return numberedMoves(pos, sans)
    .map((m) => m.prefix + m.san)
    .join(' ');
}

/** Format centipawns for display: "+1.2", "−0.4", "M3", "−M2". */
export function formatScore(cp: number): string {
  const MATE = 100_000;
  if (Math.abs(cp) > MATE / 2) {
    const n = Math.round((MATE - Math.abs(cp)) / 100);
    return `${cp < 0 ? '−' : ''}M${n}`;
  }
  const pawns = (Math.abs(cp) / 100).toFixed(1);
  if (pawns === '0.0') return '0.0'; // no "−0.0" for tiny negatives
  return cp > 0 ? `+${pawns}` : `−${pawns}`;
}

/** Book line before the deviation, with move numbers. */
export const historyText = (quiz: Quiz): string => formatLine(initial(), quiz.history.map((m) => m.san));

/** Convenience for tests and tooling: resolve a SAN move in the quiz position. */
export const specFromSan = (quiz: Quiz, san: string): MoveSpec => parseSan(quiz.position, san);

// ── Plain-language explanations ────────────────────────────────────────

const MATE_CP = 50_000; // scores beyond this are forced mates (see scoreToCp)
const pawns = (cp: number): string => (Math.abs(cp) / 100).toFixed(1);
const isMate = (cp: number): boolean => Math.abs(cp) > MATE_CP;

/** The rating scale, in the order shown to the learner. */
export const GRADE_INFO: { grade: Grade; label: string; rule: string; correct: boolean }[] = [
  { grade: 'best', label: 'Best', rule: 'The engine’s top choice.', correct: true },
  {
    grade: 'good',
    label: 'Good',
    rule: 'Within a small margin of the best move (0.3 to 1 pawn, more when you are already well ahead), or keeps a winning advantage.',
    correct: true,
  },
  { grade: 'inaccuracy', label: 'Inaccuracy', rule: `Gives away up to ${pawns(LOSS_LIMIT.inaccuracy)} pawn of advantage.`, correct: false },
  {
    grade: 'mistake',
    label: 'Mistake',
    rule: `Gives away ${pawns(LOSS_LIMIT.inaccuracy)} to ${pawns(LOSS_LIMIT.mistake)} pawns of advantage.`,
    correct: false,
  },
  { grade: 'blunder', label: 'Blunder', rule: `Gives away more than ${pawns(LOSS_LIMIT.mistake)} pawns: usually a piece or the game.`, correct: false },
];

/** Describe an evaluation (learner's point of view) in words. */
export function describeEval(cp: number): string {
  if (isMate(cp)) return cp > 0 ? 'you have a forced mate' : 'your opponent has a forced mate';
  const who = cp > 0 ? 'you' : 'your opponent';
  const size = Math.abs(cp);
  if (size < 30) return 'the position is about equal';
  if (size < 100) return `${who === 'you' ? 'you are' : 'your opponent is'} slightly better`;
  if (size < 250) return `${who === 'you' ? 'you are' : 'your opponent is'} clearly better`;
  return `${who === 'you' ? 'you are' : 'your opponent is'} winning`;
}

/** Roughly what a loss in centipawns is worth in material. */
export function materialEquivalent(loss: number): string {
  if (loss < 75) return 'less than a pawn';
  if (loss < 150) return 'about a pawn';
  if (loss < 250) return 'about two pawns';
  if (loss < 400) return 'about a knight or bishop';
  if (loss < 700) return 'about a rook';
  return 'more than a rook';
}

export interface Explanation {
  /** What the grade means for this move. */
  meaning: string;
  /** Before/after evaluations in words. */
  comparison: string;
}

/** Explain a verdict in plain language. `bestSan` is the engine's top move, numbered. */
export interface MoveFacts {
  grade: Grade;
  /** Evaluation after the best move, and after the move played (centipawns, mover's view). */
  bestCp: number;
  scoreCp: number;
  /** The move played and the best move, numbered ("5.h3", "5.d4"). */
  played: string;
  best: string;
  /** Wording for the "good enough" margin: a quiz answer is "correct", a game move "good". */
  context: 'quiz' | 'game';
}

/** Explain how good a move was, in plain language. */
export function explainMove({ grade, bestCp, scoreCp, played, best, context }: MoveFacts): Explanation {
  const loss = Math.max(0, bestCp - scoreCp);
  const margin = pawns(tolerance(bestCp));
  const counts = context === 'quiz' ? 'counts as correct here' : 'still counts as a good move';

  let meaning: string;
  if (grade === 'best') {
    meaning = 'This is the engine’s top choice.';
  } else if (isMate(bestCp) && !isMate(scoreCp)) {
    meaning = `You had a forced mate with ${best} and missed it.`;
  } else if (isMate(scoreCp) && scoreCp < 0) {
    meaning = `This allows your opponent a forced mate. ${best} was the right move.`;
  } else if (grade === 'good') {
    meaning =
      bestCp >= DECISIVE && loss > tolerance(bestCp)
        ? `You were already winning, and this move keeps a decisive advantage. ${best} was even stronger.`
        : `Practically as strong as the engine’s top choice ${best}: the difference is ${pawns(loss)} pawns, inside the ${margin}-pawn margin that ${counts}.`;
  } else if (grade === 'inaccuracy') {
    meaning = `Not a serious error, but ${best} was more precise. You give up ${pawns(loss)} pawns of advantage, more than the ${margin}-pawn margin that ${counts}.`;
  } else {
    const severity = grade === 'mistake' ? 'A real error' : 'A serious error';
    meaning = `${severity}: compared with ${best}, it gives away ${pawns(loss)} pawns of advantage, ${materialEquivalent(loss)}.`;
  }

  const comparison =
    grade === 'best'
      ? `After ${played}, ${describeEval(scoreCp)} (${formatScore(scoreCp)}).`
      : `With the best move, ${describeEval(bestCp)} (${formatScore(bestCp)}). After ${played}, ${describeEval(scoreCp)} (${formatScore(scoreCp)}).`;

  return { meaning, comparison };
}

/** Explain a quiz verdict in plain language. `bestSan` is the engine's top move, numbered. */
export function explainVerdict(quiz: Quiz, verdict: Verdict, bestSan: string): Explanation {
  return explainMove({
    grade: verdict.grade,
    bestCp: scoreToCp(quiz.answers[0].score),
    scoreCp: verdict.score,
    played: `${moveNumber(quiz.position)}${verdict.move.san}`,
    best: bestSan,
    context: 'quiz',
  });
}
