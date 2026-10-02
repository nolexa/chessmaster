// Play mode logic: an opening book for the engine opponent, and game helpers.
import { positionKey, replay, toUci, type Color, type GameEnd, type Position } from './chess';
import { ELO_RANGE } from './engine';
import { sanList, type Opening } from './openings';

export interface BookMove {
  uci: string;
  san: string;
  /** Names of the variations that play this move here. */
  variations: string[];
}

/** Book moves by position (keyed without move counters, so transpositions count). */
export type Book = Map<string, BookMove[]>;

/** The book for one opening: all its variations, or only `variationIndex`. */
export function buildBook(opening: Opening, variationIndex: number | null = null): Book {
  const book: Book = new Map();
  opening.variations.forEach((variation, vi) => {
    if (variationIndex !== null && vi !== variationIndex) return;
    const { positions, moves } = replay(sanList(variation));
    moves.forEach((move, i) => {
      const key = positionKey(positions[i]);
      const entries = book.get(key) ?? [];
      const uci = toUci(move);
      const existing = entries.find((e) => e.uci === uci);
      if (existing) {
        if (!existing.variations.includes(variation.name)) existing.variations.push(variation.name);
      } else {
        entries.push({ uci, san: move.san.replace(/[+#]$/, ''), variations: [variation.name] });
      }
      book.set(key, entries);
    });
  });
  return book;
}

export const bookMovesAt = (book: Book, pos: Position): BookMove[] => book.get(positionKey(pos)) ?? [];

/**
 * Choose the opponent's book move. Each variation still in play is equally
 * likely, so over several games every variant comes up.
 */
export function pickBookMove(moves: BookMove[], rng: () => number = Math.random): BookMove | null {
  const total = moves.reduce((n, m) => n + m.variations.length, 0);
  let r = rng() * total;
  for (const m of moves) {
    r -= m.variations.length;
    if (r < 0) return m;
  }
  return moves[moves.length - 1] ?? null;
}

export const DEFAULT_ELO = 1500;
export { ELO_RANGE };

/** A rough description of a playing strength. */
export function strengthLabel(elo: number): string {
  if (elo < 1500) return 'Casual player';
  if (elo < 1800) return 'Club player';
  if (elo < 2000) return 'Strong club player';
  if (elo < 2200) return 'Expert';
  if (elo < 2500) return 'Master';
  if (elo < 2800) return 'Grandmaster';
  return 'Super grandmaster';
}

/** Thinking time per move: a little longer at higher strength, still snappy. */
export const thinkTime = (elo: number): number => (elo < 2000 ? 400 : elo < 2600 ? 700 : 1000);

export type Outcome = 'win' | 'draw' | 'loss';

export function outcomeFor(end: GameEnd, learner: Color): Outcome {
  if (end.result === '1/2-1/2') return 'draw';
  return (end.result === '1-0') === (learner === 'w') ? 'win' : 'loss';
}

const REASON_TEXT: Record<GameEnd['reason'], string> = {
  checkmate: 'by checkmate',
  stalemate: 'by stalemate',
  repetition: 'by threefold repetition',
  'fifty-move': 'by the fifty-move rule',
  'insufficient-material': 'by insufficient material',
};

/** "You won by checkmate", "Draw by stalemate", "You resigned", … */
export function resultText(end: GameEnd | { resigned: Color }, learner: Color): string {
  if ('resigned' in end) return end.resigned === learner ? 'You resigned' : 'The engine resigned';
  const outcome = outcomeFor(end, learner);
  const how = REASON_TEXT[end.reason];
  if (outcome === 'draw') return `Draw ${how}`;
  return outcome === 'win' ? `You won ${how}` : `You lost ${how}`;
}
