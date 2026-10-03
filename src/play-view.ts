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
import {
  GRADE_LABEL,
  GRADE_MARK,
  commentOnMove,
  gameAccuracy,
  rateMove,
  toPgn,
  type MoveRating,
} from './review';
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
  /** Variations that play this book move. */
  bookVariations?: string[];
  /** For your first non-book move: the book moves you could have played. */
  deviation?: BookMove[];
  /** Engine rating of your non-book moves, once analysed. */
  rating?: MoveRating;
  ratingFailed?: boolean;
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
    /** One of your moves being reviewed on the board (its ply), or null for the live game. */
    reviewing: null as number | null,
    /** Increments on every new game or take-back, so stale engine replies are dropped. */
    epoch: 0,
    record: { win: 0, draw: 0, loss: 0, ...readStorage<Partial<Record3>>(RECORD_KEY, {}) } as Record3,
  };

  const current = () => state.positions[state.positions.length - 1];
  const userToMove = () => !state.ending && !state.thinking && current().turn === state.side;
  const getEngine = () => (engine ??= getBrowserEngine('play'));
  // A separate full-strength engine rates your moves without delaying the opponent.
  let reviewEngine: Engine | null = null;
  const getReviewEngine = () => (reviewEngine ??= getBrowserEngine('review'));
  const yourMoves = () => state.played.map((p, ply) => ({ p, ply })).filter(({ p }) => p.move.color === state.side);

  // ── Game flow ──────────────────────────────────────────────────────
  function newGame(): void {
    state.epoch++;
    Object.assign(state, {
      positions: [initial()],
      played: [],
      exit: null,
      thinking: false,
      ending: null,
      counted: false,
      reviewing: null,
    });
    state.book = buildBook(state.opening, state.variation);
    render(false);
    if (current().turn !== state.side) void engineMove();
  }

  function push(spec: MoveSpec, extra: Omit<PlayedMove, 'move'>): PlayedMove {
    const { position, move } = makeMove(current(), spec);
    const played: PlayedMove = { move, ...extra };
    state.positions.push(position);
    state.played.push(played);
    return played;
  }

  /** Rate one of your moves in the background; ignored if it was taken back meanwhile. */
  async function rate(played: PlayedMove, before: Position): Promise<void> {
    try {
      played.rating = await rateMove(getReviewEngine(), before, played.move);
    } catch {
      played.ratingFailed = true;
    }
    if (!state.played.includes(played)) return;
    renderMoves();
    renderReview();
    renderResult();
    if (state.reviewing !== null) renderBoard(false);
  }

  function onUserMove(spec: MoveSpec, { dragged }: { dragged: boolean }): void {
    if (!userToMove()) return;
    const before = current();
    const bookMoves = bookMovesAt(state.book, before);
    const uci = toUci(spec);
    const bookMove = bookMoves.find((m) => m.uci === uci);
    const leaving = !bookMove && bookMoves.length > 0 && !state.exit;
    if (leaving) state.exit = { ply: state.played.length, how: 'you', expected: bookMoves };
    const played = push(spec, {
      book: !!bookMove,
      bookVariations: bookMove?.variations,
      deviation: leaving ? bookMoves : undefined,
    });
    state.reviewing = null;
    if (!bookMove) void rate(played, before);
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
    if (spec) push(spec, { book: fromBook });
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
    if (state.reviewing !== null && state.reviewing >= state.played.length) state.reviewing = null;
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
    renderReview();
    renderResult();
    renderRecord();
  }

  function renderBoard(animate: boolean): void {
    const bottom = state.flipped ? other(state.side) : state.side;
    if (state.reviewing !== null) {
      // Show the position before the reviewed move: your move and the best move as arrows.
      const ply = state.reviewing;
      const { move, rating } = state.played[ply];
      const before = state.positions[ply];
      const arrows = [{ from: move.from, to: move.to, kind: 'played' }];
      if (rating && rating.bestUci !== toUci(move)) {
        const best = parseUci(before, rating.bestUci);
        arrows.push({ from: best.from, to: best.to, kind: 'best' });
      }
      board.render(before, { bottom, lastMove: state.played[ply - 1]?.move, arrows });
      return;
    }
    const last = state.played[state.played.length - 1]?.move;
    const showArrows = state.showBook && userToMove();
    board.render(current(), {
      bottom,
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
    if (state.reviewing !== null) {
      const ply = state.reviewing;
      status = `Reviewing ${moveNumber(state.positions[ply])}${state.played[ply].move.san}`;
    } else if (state.ending) status = resultText(state.ending, state.side);
    else if (state.thinking) status = bookMovesAt(state.book, current()).length ? 'Engine plays from the book…' : 'Engine is thinking…';
    else status = `Your move (${SIDE_NAME[state.side]})`;
    $('play-status').textContent = status;

    const hasUserMove = state.played.some((p) => p.move.color === state.side);
    $<HTMLButtonElement>('play-takeback').disabled = state.thinking || !hasUserMove;
    $<HTMLButtonElement>('play-resign').disabled = !!state.ending || !state.played.length;
    $<HTMLButtonElement>('play-copy-pgn').disabled = !state.played.length;
    $<HTMLButtonElement>('play-download-pgn').disabled = !state.played.length;
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
        const mine = p.move.color === state.side;
        const m = el(mine ? 'button' : 'span', 'pm');
        m.textContent = p.move.san;
        if (p.book) m.classList.add('book');
        if (mine && !p.book) {
          if (p.rating) {
            m.classList.add(`grade-${p.rating.grade}`);
            m.textContent += GRADE_MARK[p.rating.grade];
            m.title = `${GRADE_LABEL[p.rating.grade]} · accuracy ${Math.round(p.rating.accuracy)}%`;
          } else if (!p.ratingFailed) m.classList.add('pending');
        }
        if (p.deviation) m.classList.add('left-book');
        if (idx === state.played.length - 1) m.classList.add('current');
        if (idx === state.reviewing) m.classList.add('reviewing');
        if (mine && m instanceof HTMLButtonElement) {
          m.type = 'button';
          m.addEventListener('click', () => toggleReview(idx));
        }
        li.append(m);
      }
      list.append(li);
    }
    if (state.reviewing === null) list.scrollTop = list.scrollHeight;
  }

  function toggleReview(ply: number): void {
    state.reviewing = state.reviewing === ply ? null : ply;
    renderBoard(false);
    renderStatus();
    renderMoves();
    renderReview();
  }

  /** Accuracy summary and the comment on the reviewed (or your latest) move. */
  function renderReview(): void {
    const mine = yourMoves();
    const rated = mine.filter(({ p }) => p.rating).map(({ p }) => p.rating!);
    const pending = mine.filter(({ p }) => !p.book && !p.rating && !p.ratingFailed).length;
    const books = mine.filter(({ p }) => p.book).length;
    const accuracy = gameAccuracy(rated.map((r) => r.accuracy));
    const count = (g: MoveRating['grade']) => rated.filter((r) => r.grade === g).length;

    const summary = $('play-accuracy');
    if (!mine.length) {
      summary.replaceChildren(el('p', 'small muted', 'Your moves are rated by a full-strength engine as you play.'));
    } else {
      const head = el('div', 'accuracy-head');
      head.append(
        el('strong', 'accuracy-value', accuracy === null ? '—' : `${Math.round(accuracy)}%`),
        el('span', 'small muted', accuracy === null ? 'accuracy (book moves only so far)' : `accuracy over ${rated.length} rated move${rated.length === 1 ? '' : 's'}`),
      );
      const chips = el('div', 'grade-chips');
      const chip = (cls: string, text: string) => chips.append(el('span', `chip ${cls}`, text));
      chip('book', `📖 ${books} book`);
      chip('grade-best', `${count('best') + count('good')} good`);
      chip('grade-inaccuracy', `?! ${count('inaccuracy')}`);
      chip('grade-mistake', `? ${count('mistake')}`);
      chip('grade-blunder', `?? ${count('blunder')}`);
      if (pending) chip('pending', `analysing ${pending}…`);
      summary.replaceChildren(head, chips);
    }

    // Comment on the reviewed move, or on your latest move.
    const box = $('play-comment');
    const target = state.reviewing !== null ? { p: state.played[state.reviewing], ply: state.reviewing } : mine[mine.length - 1];
    box.hidden = !target;
    if (!target) return;
    const { p, ply } = target;
    const before = state.positions[ply];
    const grade = p.rating?.grade;
    box.className = `feedback comment ${p.book ? 'book' : grade === 'best' || grade === 'good' ? 'ok' : grade === 'inaccuracy' ? 'warn' : grade ? 'bad' : ''}`;

    const head = el('p', 'verdict');
    const label = p.book ? '📖 Book' : p.rating ? GRADE_LABEL[p.rating.grade] : p.ratingFailed ? 'Not rated' : 'Analysing…';
    head.append(el('strong', '', label), ` ${moveNumber(before)}${p.move.san}${p.rating ? GRADE_MARK[p.rating.grade] : ''}`);
    if (p.rating) head.append(' ', el('span', 'eval', `${Math.round(p.rating.accuracy)}%`));
    const text = commentOnMove(before, p.move, {
      book: p.book ? { variations: p.bookVariations ?? [] } : undefined,
      rating: p.rating,
      deviation: p.deviation
        ? { expected: p.deviation.map((m) => ({ san: `${moveNumber(before)}${m.san}`, variations: m.variations })) }
        : undefined,
    });
    const parts: HTMLElement[] = [head, ...text.map((t) => el('p', '', t))];
    if (p.ratingFailed) parts.push(el('p', 'small muted', 'The engine could not rate this move.'));

    const actions = el('div', 'comment-actions');
    if (state.reviewing !== null) {
      const back = el('button', 'step-btn', '← Back to game');
      back.type = 'button';
      back.addEventListener('click', () => toggleReview(state.reviewing!));
      actions.append(back);
    } else if (p.rating && p.rating.grade !== 'best') {
      const show = el('button', 'step-btn', 'Show on board');
      show.type = 'button';
      show.addEventListener('click', () => toggleReview(ply));
      actions.append(show);
    }
    if (actions.childElementCount) parts.push(actions);
    box.replaceChildren(...parts);
  }

  /** The game so far as annotated PGN. */
  function pgn(): string {
    const ending = state.ending;
    let result = '*';
    if (ending) {
      if ('resigned' in ending) result = ending.resigned === 'w' ? '0-1' : '1-0';
      else result = ending.result;
    }
    const you = 'You';
    const engineName = `Stockfish (${state.elo} Elo)`;
    return toPgn(
      {
        event: 'Chessmaster Openings: play',
        site: location.origin,
        date: new Date(),
        white: state.side === 'w' ? you : engineName,
        black: state.side === 'b' ? you : engineName,
        result,
        opening:
          state.opening.name + (state.variation === null ? '' : `: ${state.opening.variations[state.variation].name}`),
      },
      state.played.map((p, i) => ({ move: p.move, before: state.positions[i], book: p.book, rating: p.rating })),
      state.side,
    );
  }

  async function copyPgn(): Promise<void> {
    const btn = $<HTMLButtonElement>('play-copy-pgn');
    const text = pgn();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = '✓ Copied';
      setTimeout(() => (btn.textContent = 'Copy PGN'), 1500);
    } catch {
      // Clipboard blocked (permissions, insecure context): let the user copy it by hand.
      const dialog = $<HTMLDialogElement>('play-pgn-dialog');
      const area = $<HTMLTextAreaElement>('play-pgn-text');
      area.value = text;
      dialog.showModal();
      area.select();
    }
  }

  function downloadPgn(): void {
    const blob = new Blob([pgn()], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chessmaster-${state.opening.id}-${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
    const rated = yourMoves().filter(({ p }) => p.rating).map(({ p }) => p.rating!.accuracy);
    const accuracy = gameAccuracy(rated);
    const parts: HTMLElement[] = [text];
    if (accuracy !== null) parts.push(el('p', 'small', `Your accuracy this game: ${Math.round(accuracy)}%.`));
    box.replaceChildren(...parts, again);
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
  $('play-copy-pgn').addEventListener('click', () => void copyPgn());
  $('play-download-pgn').addEventListener('click', downloadPgn);
  $('play-pgn-close').addEventListener('click', () => $<HTMLDialogElement>('play-pgn-dialog').close());
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
