// Play mode: a game against Stockfish, which follows the chosen opening's book.
import { BoardView } from './board';
import {
  gameEnd,
  initial,
  makeMove,
  moveNumber,
  other,
  parseUci,
  toFen,
  toUci,
  type Color,
  type GameEnd,
  type Move,
  type MoveSpec,
  type Position,
} from './chess';
import { $, el } from './dom';
import { getBrowserEngine, type Engine } from './engine';
import { findOpening, groupOpenings, openingsFor } from './openings';
import {
  DEFAULT_ELO,
  ELO_RANGE,
  bookMovesAt,
  buildBook,
  outcomeFor,
  pickBookMove,
  resultText,
  strengthLabel,
  thinkTime,
  type Book,
  type BookMove,
  type Outcome,
} from './play';

export interface PlayView {
  /** Show play mode for `side`; optionally an opening id and variation number (0 = any). */
  show(side: Color, openingId?: string, variation?: number): void;
  hide(): void;
  readonly side: Color;
}

type Ending = GameEnd | { resigned: Color };

interface PlayedMove {
  move: Move;
  /** Whether this move was a book move of the chosen opening. */
  book: boolean;
}

/** Where the game left the opening book, if it has. */
interface BookExit {
  ply: number;
  /** "you" played a non-book move, or the "line" ran out of book moves. */
  how: 'you' | 'line';
  /** Book moves that were available when you deviated. */
  expected: BookMove[];
}

const RECORD_KEY = 'chessmaster.play.record.v1';
const ELO_KEY = 'chessmaster.play.elo.v1';
const SIDE_NAME: Record<Color, string> = { w: 'White', b: 'Black' };
const BOOK_DELAY = 450;

type Record3 = { [K in Outcome]: number };

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: settings and record just won't persist.
  }
}

export function createPlayView(): PlayView {
  const root = $('play-view');
  const board = new BoardView($('play-board'));
  const openingSelect = $<HTMLSelectElement>('play-opening');
  const variationSelect = $<HTMLSelectElement>('play-variation');
  const eloInput = $<HTMLInputElement>('play-elo');
  let engine: Engine | null = null;

  const state = {
    active: false,
    side: 'w' as Color,
    opening: openingsFor('w')[0],
    /** Variation index, or null for any variation. */
    variation: null as number | null,
    book: new Map() as Book,
    elo: readStorage<number>(ELO_KEY, DEFAULT_ELO),
    positions: [initial()] as Position[],
    played: [] as PlayedMove[],
    exit: null as BookExit | null,
    thinking: false,
    ending: null as Ending | null,
    counted: false,
    flipped: false,
    showBook: false,
    /** Increments on every new game or take-back, so stale engine replies are dropped. */
    epoch: 0,
    record: { win: 0, draw: 0, loss: 0, ...readStorage<Partial<Record3>>(RECORD_KEY, {}) } as Record3,
  };

  const current = () => state.positions[state.positions.length - 1];
  const userToMove = () => !state.ending && !state.thinking && current().turn === state.side;
  const getEngine = () => (engine ??= getBrowserEngine('play'));

  // ── Game flow ──────────────────────────────────────────────────────
  function newGame(): void {
    state.epoch++;
    Object.assign(state, { positions: [initial()], played: [], exit: null, thinking: false, ending: null, counted: false });
    state.book = buildBook(state.opening, state.variation);
    render(false);
    if (current().turn !== state.side) void engineMove();
  }

  function push(spec: MoveSpec, book: boolean): void {
    const { position, move } = makeMove(current(), spec);
    state.positions.push(position);
    state.played.push({ move, book });
  }

  function onUserMove(spec: MoveSpec, { dragged }: { dragged: boolean }): void {
    if (!userToMove()) return;
    const bookMoves = bookMovesAt(state.book, current());
    const uci = toUci(spec);
    const inBook = bookMoves.some((m) => m.uci === uci);
    if (!inBook && bookMoves.length && !state.exit) {
      state.exit = { ply: state.played.length, how: 'you', expected: bookMoves };
    }
    push(spec, inBook);
    render(!dragged);
    if (!finishIfOver()) void engineMove();
  }

  async function engineMove(): Promise<void> {
    const epoch = state.epoch;
    state.thinking = true;
    renderStatus();
    const pos = current();
    const bookMoves = bookMovesAt(state.book, pos);
    let spec: MoveSpec | null = null;
    let fromBook = false;

    if (bookMoves.length) {
      await new Promise((r) => setTimeout(r, BOOK_DELAY));
      const choice = pickBookMove(bookMoves);
      if (choice) {
        spec = parseUci(pos, choice.uci);
        fromBook = true;
      }
    } else {
      if (!state.exit) state.exit = { ply: state.played.length, how: 'line', expected: [] };
      const uci = await getEngine().bestMove(toFen(pos), { movetime: thinkTime(state.elo), elo: state.elo });
      if (uci) spec = parseUci(pos, uci);
    }
    if (epoch !== state.epoch) return; // new game or take-back while thinking

    state.thinking = false;
    if (spec) push(spec, fromBook);
    render(true);
    finishIfOver();
  }

  function finishIfOver(): boolean {
    const end = gameEnd(state.positions);
    if (!end) return false;
    endGame(end);
    return true;
  }

  function endGame(ending: Ending): void {
    state.ending = ending;
    state.thinking = false;
    if (!state.counted) {
      state.counted = true;
      const outcome: Outcome = 'resigned' in ending ? (ending.resigned === state.side ? 'loss' : 'win') : outcomeFor(ending, state.side);
      state.record[outcome]++;
      writeStorage(RECORD_KEY, state.record);
    }
    render(false);
  }

  function takeBack(): void {
    if (state.thinking || !state.played.some((p) => p.move.color === state.side)) return;
    state.epoch++;
    // Remove moves until it is your turn again, having undone at least your last move.
    do {
      state.positions.pop();
      state.played.pop();
    } while (state.played.length && current().turn !== state.side);
    state.ending = null;
    if (state.exit && state.exit.ply >= state.played.length) state.exit = null;
    render(false);
  }

  function resign(): void {
    if (state.ending || !state.played.length) return;
    state.epoch++;
    endGame({ resigned: state.side });
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function render(animate: boolean): void {
    renderBoard(animate);
    renderStatus();
    renderBook();
    renderMoves();
    renderResult();
    renderRecord();
  }

  function renderBoard(animate: boolean): void {
    const last = state.played[state.played.length - 1]?.move;
    const showArrows = state.showBook && userToMove();
    board.render(current(), {
      bottom: state.flipped ? other(state.side) : state.side,
      lastMove: last,
      animate,
      arrows: showArrows
        ? bookMovesAt(state.book, current()).map((m) => {
            const spec = parseUci(current(), m.uci);
            return { from: spec.from, to: spec.to, kind: 'book' };
          })
        : [],
      interactive: userToMove() ? { color: state.side, onMove: onUserMove } : undefined,
    });
  }

  function renderStatus(): void {
    const o = state.opening;
    $('play-title').textContent = o.name;
    $('play-subtitle').textContent =
      `${state.variation === null ? 'Any variation' : o.variations[state.variation].name} · engine ${state.elo} Elo`;
    let status: string;
    if (state.ending) status = resultText(state.ending, state.side);
    else if (state.thinking) status = bookMovesAt(state.book, current()).length ? 'Engine plays from the book…' : 'Engine is thinking…';
    else status = `Your move (${SIDE_NAME[state.side]})`;
    $('play-status').textContent = status;

    const hasUserMove = state.played.some((p) => p.move.color === state.side);
    $<HTMLButtonElement>('play-takeback').disabled = state.thinking || !hasUserMove;
    $<HTMLButtonElement>('play-resign').disabled = !!state.ending || !state.played.length;
    // While the engine thinks the board stays visible but not movable.
    $('play-board').classList.toggle('waiting', state.thinking);
  }

  function renderBook(): void {
    const box = $('play-book');
    const exit = state.exit;
    const parts: HTMLElement[] = [];

    if (!exit) {
      const here = bookMovesAt(state.book, current());
      const lines = [...new Set(here.flatMap((m) => m.variations))];
      parts.push(el('p', 'in-book', state.played.length ? '✓ In book' : `The engine plays the ${state.opening.name}.`));
      if (lines.length > 1) parts.push(el('p', 'small muted', `Lines still possible: ${lines.join(', ')}.`));
      else if (lines.length === 1) parts.push(el('p', 'small muted', `Line: ${lines[0]}.`));
    } else if (exit.how === 'you') {
      const played = state.played[exit.ply].move;
      const before = state.positions[exit.ply];
      const p = el('p', 'left-book');
      p.append('You left the book with ', el('strong', '', `${moveNumber(before)}${played.san}`), '.');
      parts.push(p);
      const list = el('ul', 'book-alternatives');
      for (const m of exit.expected) {
        const li = el('li');
        li.append(el('strong', '', `${moveNumber(before)}${m.san}`), ` (${m.variations.join(', ')})`);
        list.append(li);
      }
      parts.push(el('p', 'small', 'The book continues with:'), list);
      parts.push(el('p', 'small muted', 'Take back to try the book move, or play on against the engine.'));
    } else {
      const lastBook = exit.ply > 0 ? state.played[exit.ply - 1].move : null;
      parts.push(
        el(
          'p',
          'small',
          lastBook
            ? `The book line ended after ${moveNumber(state.positions[exit.ply - 1])}${lastBook.san}. The engine plays on its own from here.`
            : 'The engine plays on its own from here.',
        ),
      );
    }
    box.replaceChildren(...parts);
  }

  function renderMoves(): void {
    const list = $('play-moves');
    list.replaceChildren();
    const start = state.positions[0];
    for (let i = 0; i < state.played.length; i += 2) {
      const li = el('li');
      li.append(el('span', 'num', `${start.fullmove + i / 2}.`));
      for (const idx of [i, i + 1]) {
        const p = state.played[idx];
        if (!p) {
          li.append(el('span'));
          continue;
        }
        const m = el('span', 'pm', p.move.san);
        if (p.book) m.classList.add('book');
        if (state.exit?.how === 'you' && state.exit.ply === idx) m.classList.add('left-book');
        if (idx === state.played.length - 1) m.classList.add('current');
        li.append(m);
      }
      list.append(li);
    }
    list.scrollTop = list.scrollHeight;
  }

  function renderResult(): void {
    const box = $('play-result');
    const ending = state.ending;
    box.hidden = !ending;
    if (!ending) return;
    const outcome: Outcome = 'resigned' in ending ? (ending.resigned === state.side ? 'loss' : 'win') : outcomeFor(ending, state.side);
    box.className = `feedback ${outcome === 'win' ? 'ok' : outcome === 'draw' ? 'warn' : 'bad'}`;
    const again = el('button', 'wide-btn', 'New game');
    again.type = 'button';
    again.addEventListener('click', newGame);
    const text = el('p', 'verdict');
    text.append(el('strong', '', resultText(ending, state.side)));
    box.replaceChildren(text, again);
  }

  function renderRecord(): void {
    const r = state.record;
    const stat = (value: number, label: string) => {
      const d = el('div', 'stat');
      d.append(el('strong', '', String(value)), el('span', '', label));
      return d;
    };
    $('play-record').replaceChildren(stat(r.win, 'wins'), stat(r.draw, 'draws'), stat(r.loss, 'losses'));
  }

  function renderSettings(): void {
    const groups = groupOpenings(state.side).map(({ label, openings }) => {
      const g = el('optgroup');
      g.label = label;
      g.append(...openings.map((o) => new Option(o.name, o.id)));
      return g;
    });
    openingSelect.replaceChildren(...groups);
    openingSelect.value = state.opening.id;
    variationSelect.replaceChildren(
      new Option('Any variation (random)', '0'),
      ...state.opening.variations.map((v, i) => new Option(v.name, String(i + 1))),
    );
    variationSelect.value = String(state.variation === null ? 0 : state.variation + 1);
    eloInput.min = String(ELO_RANGE.min);
    eloInput.max = String(ELO_RANGE.max);
    eloInput.value = String(state.elo);
    renderElo();
  }

  function renderElo(): void {
    $('play-elo-value').textContent = String(state.elo);
    $('play-elo-label').textContent = strengthLabel(state.elo);
  }

  // ── Wiring ─────────────────────────────────────────────────────────
  const navigate = (openingId: string, variation: number) => {
    location.hash = `#play/${state.side === 'w' ? 'white' : 'black'}/${openingId}/${variation}`;
  };
  openingSelect.addEventListener('change', () => navigate(openingSelect.value, 0));
  variationSelect.addEventListener('change', () => navigate(state.opening.id, Number(variationSelect.value)));
  eloInput.addEventListener('input', () => {
    state.elo = Number(eloInput.value);
    writeStorage(ELO_KEY, state.elo);
    renderElo();
    renderStatus();
  });
  $('play-new').addEventListener('click', newGame);
  $('play-takeback').addEventListener('click', takeBack);
  $('play-resign').addEventListener('click', resign);
  $('play-flip').addEventListener('click', () => {
    state.flipped = !state.flipped;
    renderBoard(false);
  });
  $<HTMLInputElement>('play-show-book').addEventListener('change', (e) => {
    state.showBook = (e.target as HTMLInputElement).checked;
    renderBoard(false);
  });
  $('play-reset').addEventListener('click', () => {
    state.record = { win: 0, draw: 0, loss: 0 };
    writeStorage(RECORD_KEY, state.record);
    renderRecord();
  });

  return {
    show(side, openingId, variation = 0) {
      root.hidden = false;
      state.active = true;
      const requested = findOpening(openingId ?? '');
      const opening = requested && requested.side === side ? requested : state.opening.side === side ? state.opening : openingsFor(side)[0];
      const variationIndex = variation > 0 && variation <= opening.variations.length ? variation - 1 : null;
      const changed =
        side !== state.side || opening !== state.opening || variationIndex !== state.variation || state.epoch === 0;
      state.side = side;
      state.opening = opening;
      state.variation = variationIndex;
      renderSettings();
      if (changed) {
        state.flipped = false;
        newGame();
      } else {
        render(false);
      }
    },
    hide() {
      root.hidden = true;
      state.active = false;
    },
    get side() {
      return state.side;
    },
  };
}
