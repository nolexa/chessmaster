// Quiz mode: the opponent leaves the book; the learner finds the best reply.
import { BoardView } from './board';
import { initial, makeMove, moveNumber, other, parseUci, type Color, type MoveSpec } from './chess';
import { $, el } from './dom';
import { getBrowserEngine, scoreToCp, type Engine } from './engine';
import { LinePlayer, type PlayableLine } from './line-player';
import { findOpening, groupOpenings, openingsFor, type Opening } from './openings';
import {
  GRADE_INFO,
  acceptedAnswers,
  annotation,
  createQuiz,
  explainVerdict,
  formatScore,
  historyText,
  judge,
  numberedMoves,
  type Grade,
  type Quiz,
  type Verdict,
} from './quiz';

export interface QuizView {
  /** Show quiz mode for `side`; `scope` is an opening id or "all". */
  show(side: Color, scope?: string): void;
  hide(): void;
  readonly side: Color;
}

type Phase = 'loading' | 'asking' | 'judging' | 'wrong' | 'done' | 'error';

interface Stats {
  attempted: number;
  solved: number;
  streak: number;
  best: number;
}

const STATS_KEY = 'chessmaster.quiz.stats.v1';
const EMPTY_STATS: Stats = { attempted: 0, solved: 0, streak: 0, best: 0 };

function loadStats(): Stats {
  try {
    return { ...EMPTY_STATS, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? '{}') };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Storage unavailable (private mode etc.): stats just won't persist.
  }
}

const SIDE_NAME: Record<Color, string> = { w: 'White', b: 'Black' };

/** Longest line (in plies) shown and played back. */
const MAX_LINE = 10;

const GRADE_TEXT: Record<Grade, string> = {
  best: 'Best move!',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
};

export function createQuizView(): QuizView {
  const root = $('quiz-view');
  const board = new BoardView($('quiz-board'));
  const scopeSelect = $<HTMLSelectElement>('quiz-scope');
  let engine: Engine | null = null;

  // Engine lines shown in the panel, by id, and the player that animates them.
  const lines = new Map<string, PlayableLine>();
  const player = new LinePlayer(
    (position, lastMove, animate) =>
      board.render(position, { bottom: state.quiz?.learner ?? state.side, lastMove, animate }),
    () => syncLineHighlight(),
  );

  const state = {
    active: false,
    side: 'w' as Color,
    scope: 'all',
    phase: 'loading' as Phase,
    quiz: null as Quiz | null,
    verdict: null as Verdict | null,
    /** The learner's attempted move (shown while judging). */
    attempt: null as MoveSpec | null,
    counted: false,
    hint: false,
    error: '',
    /** Increments on every new quiz so stale async results are ignored. */
    request: 0,
    prefetch: null as { key: string; quiz: Promise<Quiz> } | null,
    stats: loadStats(),
  };

  const scopeKey = () => `${state.side}/${state.scope}`;

  function scopeOpenings(): Opening[] {
    const one = findOpening(state.scope);
    return one && one.side === state.side ? [one] : openingsFor(state.side);
  }

  function getEngine(): Engine {
    engine ??= getBrowserEngine();
    return engine;
  }

  // ── Quiz lifecycle ─────────────────────────────────────────────────
  function prefetch(): void {
    if (state.prefetch?.key === scopeKey()) return;
    const quiz = createQuiz(getEngine(), scopeOpenings());
    quiz.catch(() => undefined); // surfaced when (if) it is used
    state.prefetch = { key: scopeKey(), quiz };
  }

  async function nextQuiz(): Promise<void> {
    const request = ++state.request;
    player.stop();
    Object.assign(state, { phase: 'loading', quiz: null, verdict: null, attempt: null, counted: false, hint: false });
    render();
    try {
      const pending = state.prefetch?.key === scopeKey() ? state.prefetch.quiz : createQuiz(getEngine(), scopeOpenings());
      state.prefetch = null;
      const quiz = await pending;
      if (request !== state.request) return;
      state.quiz = quiz;
      state.phase = 'asking';
      // Show the book position first, then play the opponent's deviation.
      board.render(quiz.before, { bottom: quiz.learner, lastMove: quiz.history.at(-1), arrows: bookArrow(quiz) });
      renderPanel();
      setTimeout(() => request === state.request && renderBoard(true), 500);
    } catch (e) {
      if (request !== state.request) return;
      state.phase = 'error';
      state.error = e instanceof Error ? e.message : String(e);
      render();
    }
  }

  async function onMove(move: MoveSpec, { dragged }: { dragged: boolean }): Promise<void> {
    const quiz = state.quiz;
    if (!quiz || state.phase !== 'asking') return;
    const request = state.request;
    state.phase = 'judging';
    state.attempt = move;
    const { position, move: played } = makeMove(quiz.position, move);
    board.render(position, { bottom: quiz.learner, lastMove: played, animate: !dragged });
    renderPanel();

    const verdict = await judge(getEngine(), quiz, move);
    if (request !== state.request) return;
    state.verdict = verdict;
    state.phase = verdict.correct ? 'done' : 'wrong';
    record(verdict.correct);
    renderPanel();
    // The board already shows the learner's move: continue with the engine's reply.
    const line = lines.get('verdict');
    if (line) player.play(line, 1);
    if (verdict.correct) prefetch();
  }

  /** Count only the first attempt at each quiz. */
  function record(correct: boolean): void {
    if (state.counted) return;
    state.counted = true;
    const s = state.stats;
    s.attempted++;
    if (correct) {
      s.solved++;
      s.streak++;
      s.best = Math.max(s.best, s.streak);
    } else {
      s.streak = 0;
    }
    saveStats(s);
  }

  function retry(): void {
    player.stop();
    state.phase = 'asking';
    state.verdict = null;
    state.attempt = null;
    renderBoard(false);
    renderPanel();
  }

  function reveal(): void {
    const quiz = state.quiz;
    if (!quiz) return;
    record(false);
    state.phase = 'done';
    state.attempt = null;
    renderPanel();
    const best = lines.get('answer-0');
    if (best) player.play(best);
    prefetch();
  }

  function showHint(): void {
    state.hint = true;
    renderBoard(false);
    renderPanel();
  }

  // ── Rendering ──────────────────────────────────────────────────────
  function render(): void {
    if (!state.quiz) board.render(initial(), { bottom: state.side });
    renderPanel();
  }

  function renderBoard(animate: boolean): void {
    const quiz = state.quiz;
    if (!quiz) return;
    const bestFrom = parseUci(quiz.position, quiz.answers[0].pv[0]).from;
    board.render(quiz.position, {
      bottom: quiz.learner,
      lastMove: quiz.deviation,
      animate,
      marks: state.hint ? [bestFrom] : [],
      arrows: bookArrow(quiz),
      interactive: state.phase === 'asking' ? { color: quiz.learner, onMove } : undefined,
    });
  }

  /** Arrow showing the move the book expected from the opponent. */
  function bookArrow(quiz: Quiz) {
    return [{ from: quiz.bookMove.from, to: quiz.bookMove.to, kind: 'book' }];
  }

  function renderPanel(): void {
    const { quiz, phase } = state;
    $('quiz-overlay').hidden = phase !== 'loading' && phase !== 'error';
    $('quiz-overlay-text').textContent =
      phase === 'error' ? `Couldn't prepare a quiz: ${state.error}` : 'Finding a position…';
    $('quiz-title').textContent = quiz ? quiz.opening.name : 'Quiz';
    $('quiz-subtitle').textContent = quiz ? quiz.opening.variations[quiz.variationIndex].name : '';
    $('quiz-status').textContent =
      phase === 'judging' ? 'Engine is checking…' : quiz && phase === 'asking' ? `${SIDE_NAME[quiz.learner]} to move` : '';

    $<HTMLButtonElement>('quiz-hint').disabled = phase !== 'asking' || state.hint;
    $<HTMLButtonElement>('quiz-retry').hidden = phase !== 'wrong';
    $<HTMLButtonElement>('quiz-solution').disabled = !(phase === 'asking' || phase === 'wrong');
    $<HTMLButtonElement>('quiz-next').disabled = phase === 'loading' || phase === 'judging';
    $('quiz-next').classList.toggle('primary', phase === 'done' || phase === 'error');

    renderPrompt();
    renderFeedback();
    renderAnswers();
    renderRatingHelp();
    renderStats();
  }

  function renderPrompt(): void {
    const prompt = $('quiz-prompt');
    const quiz = state.quiz;
    if (!quiz) {
      prompt.replaceChildren(el('span', 'muted', 'Preparing a position where your opponent leaves the book…'));
      return;
    }
    const opp = SIDE_NAME[other(quiz.learner)];
    const num = moveNumber(quiz.before);
    const history = quiz.history.length ? historyText(quiz) : '';
    const reveal = state.phase === 'done' || state.phase === 'wrong';
    const deviation = `${num}${quiz.deviation.san}${reveal ? annotation(quiz.deviationCost) : ''}`;

    const p = el('p');
    if (history) p.append(el('span', 'line', history), document.createElement('br'));
    p.append(`${opp} played `, el('strong', 'dev', deviation), ' instead of the book move ', el('strong', '', `${num}${quiz.bookMove.san}`), '.');
    const task = el('p', 'task', `Find the best reply for ${SIDE_NAME[quiz.learner]}.`);
    const legend = el('p', 'arrow-legend small muted');
    legend.append(el('span', 'arrow-swatch book'), `Blue arrow: the book move ${num}${quiz.bookMove.san}`);
    prompt.replaceChildren(p, legend, task);
    if (state.hint && state.phase === 'asking') {
      prompt.append(el('p', 'muted', 'Hint: the highlighted piece makes the best move.'));
    }
  }

  function renderFeedback(): void {
    const box = $('quiz-feedback');
    const { quiz, verdict, phase } = state;
    box.className = 'feedback';
    if (!quiz || phase === 'asking' || phase === 'loading') {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const userNum = moveNumber(quiz.position);

    if (phase === 'judging' && state.attempt) {
      const san = makeMove(quiz.position, state.attempt).move.san;
      box.replaceChildren(el('p', 'muted', `Checking ${userNum}${san} with the engine…`));
      return;
    }

    const parts: HTMLElement[] = [];
    const bestScore = scoreToCp(quiz.answers[0].score);
    const bestSan = `${userNum}${acceptedAnswers(quiz)[0]?.san[0] ?? ''}`;
    lines.delete('verdict');

    if (verdict) {
      box.classList.add(verdict.correct ? 'ok' : verdict.grade === 'inaccuracy' ? 'warn' : 'bad');
      const head = el('p', 'verdict');
      head.append(
        el('strong', '', `${verdict.correct ? '✓' : '✗'} ${GRADE_TEXT[verdict.grade]}`),
        ` ${userNum}${verdict.move.san} `,
        el('span', 'eval', formatScore(verdict.score)),
      );
      const { meaning, comparison } = explainVerdict(quiz, verdict, bestSan);
      parts.push(head, el('p', '', meaning), el('p', 'comparison', comparison));

      const line: PlayableLine = {
        id: 'verdict',
        start: quiz.position,
        startLastMove: quiz.deviation,
        sans: [verdict.move.san, ...verdict.continuation].slice(0, MAX_LINE),
      };
      lines.set(line.id, line);
      parts.push(
        el(
          'p',
          'line-label',
          verdict.grade === 'mistake' || verdict.grade === 'blunder'
            ? 'How the engine punishes it:'
            : 'How the game could continue:',
        ),
        lineRow(line, { yoursFirst: true }),
      );
    } else if (phase === 'done') {
      box.classList.add('bad');
    }
    if (phase === 'done' && !verdict?.correct) {
      parts.push(el('p', 'verdict', `Solution: ${bestSan} (${formatScore(bestScore)}). Watch the engine's lines below.`));
    }

    if (phase === 'done') {
      const cost = quiz.deviationCost;
      const dev = `${moveNumber(quiz.before)}${quiz.deviation.san}`;
      parts.push(
        el(
          'p',
          'about',
          cost < 25
            ? `${dev} is a playable alternative rather than a mistake, so the task was to find the most accurate continuation.`
            : `${dev}${annotation(cost)} costs ${SIDE_NAME[other(quiz.learner)]} about ${(cost / 100).toFixed(1)} pawns.`,
        ),
      );
    }
    box.replaceChildren(...parts);
  }

  function renderAnswers(): void {
    const section = $('quiz-answers');
    const quiz = state.quiz;
    section.hidden = !quiz || state.phase !== 'done';
    for (const id of [...lines.keys()]) if (id.startsWith('answer-')) lines.delete(id);
    if (!quiz || section.hidden) return;
    $('quiz-answer-list').replaceChildren(
      ...acceptedAnswers(quiz).map((a, i) => {
        const line: PlayableLine = {
          id: `answer-${i}`,
          start: quiz.position,
          startLastMove: quiz.deviation,
          sans: a.san.slice(0, MAX_LINE),
        };
        lines.set(line.id, line);
        const li = el('li');
        li.append(lineRow(line, { score: a.score, yoursFirst: true }));
        return li;
      }),
    );
    syncLineHighlight();
  }

  /** A line of moves with a Play button; each move can be clicked to jump to it. */
  function lineRow(line: PlayableLine, { score, yoursFirst = false }: { score?: number; yoursFirst?: boolean }): HTMLElement {
    const row = el('div', 'pv');
    row.dataset.line = line.id;

    const control = (label: string, cls: string, title: string, action: () => void) => {
      const btn = el('button', cls, label);
      btn.type = 'button';
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.addEventListener('click', action);
      return btn;
    };
    const controls = el('span', 'pv-controls');
    controls.append(
      control('⏮', 'step-btn to-start', 'Start of line', () => player.jump(line, 0)),
      control('◀', 'step-btn back', 'Previous move (←)', () => player.step(line, -1)),
      control('▶ Play', 'play-btn', 'Replay this line from the start', () => player.play(line)),
      control('▶', 'step-btn forward', 'Next move (→)', () => player.step(line, 1)),
      control('⏭', 'step-btn to-end', 'End of line', () => player.jump(line, line.sans.length)),
    );
    row.append(controls);
    if (score !== undefined) row.append(el('span', 'eval', formatScore(score)));

    const movesEl = el('span', 'pv-moves');
    numberedMoves(line.start, line.sans).forEach((m, i) => {
      const btn = el('button', 'pv-move', m.prefix + m.san);
      btn.type = 'button';
      btn.dataset.ply = String(i + 1);
      if (yoursFirst && i % 2 === 0) btn.classList.add('yours');
      btn.addEventListener('click', () => player.jump(line, i + 1));
      movesEl.append(btn);
    });
    row.append(movesEl);
    return row;
  }

  /** Reflect the player's state: which line is playing and which move is on the board. */
  function syncLineHighlight(): void {
    const current = player.current;
    root.querySelectorAll<HTMLElement>('.pv').forEach((row) => {
      const active = current?.id === row.dataset.line;
      row.classList.toggle('active', active);
      row.classList.toggle('playing', active && current!.playing);
      row.querySelectorAll<HTMLElement>('.pv-move').forEach((m) => {
        m.classList.toggle('current', active && Number(m.dataset.ply) === current!.index);
      });
      // Back/start only make sense once this line is on the board and past its start.
      const atStart = !active || current!.index === 0;
      const atEnd = active && current!.index >= current!.length;
      row.querySelectorAll<HTMLButtonElement>('.to-start, .back').forEach((b) => (b.disabled = atStart));
      row.querySelectorAll<HTMLButtonElement>('.forward, .to-end').forEach((b) => (b.disabled = atEnd));
    });
  }

  function renderRatingHelp(): void {
    const help = $<HTMLDetailsElement>('quiz-rating-help');
    help.hidden = !state.quiz;
    const current = state.verdict?.grade;
    $('quiz-rating-list').replaceChildren(
      ...GRADE_INFO.map((g) => {
        const li = el('li', g.correct ? 'correct' : 'wrong');
        if (g.grade === current) li.classList.add('current');
        li.append(el('strong', '', `${g.correct ? '✓' : '✗'} ${g.label}`), ` ${g.rule}`);
        return li;
      }),
    );
  }

  function renderStats(): void {
    const s = state.stats;
    const pct = s.attempted ? Math.round((s.solved / s.attempted) * 100) : 0;
    const stat = (value: string, label: string) => {
      const d = el('div', 'stat');
      d.append(el('strong', '', value), el('span', '', label));
      return d;
    };
    $('quiz-stats').replaceChildren(
      stat(`${s.solved}/${s.attempted}`, 'solved'),
      stat(`${pct}%`, 'accuracy'),
      stat(String(s.streak), 'streak'),
      stat(String(s.best), 'best streak'),
    );
  }

  function renderScopeOptions(): void {
    const groups = groupOpenings(state.side).map(({ label, openings }) => {
      const g = el('optgroup');
      g.label = label;
      g.append(...openings.map((o) => new Option(o.name, o.id)));
      return g;
    });
    scopeSelect.replaceChildren(new Option(`All ${SIDE_NAME[state.side]} openings`, 'all'), ...groups);
    scopeSelect.value = state.scope;
  }

  // ── Wiring ─────────────────────────────────────────────────────────
  scopeSelect.addEventListener('change', () => {
    location.hash = `#quiz/${state.side === 'w' ? 'white' : 'black'}/${scopeSelect.value}`;
  });
  $('quiz-hint').addEventListener('click', showHint);
  $('quiz-retry').addEventListener('click', retry);
  $('quiz-solution').addEventListener('click', reveal);
  $('quiz-next').addEventListener('click', () => void nextQuiz());
  $('quiz-reset').addEventListener('click', () => {
    state.stats = { ...EMPTY_STATS };
    saveStats(state.stats);
    renderStats();
  });

  document.addEventListener('keydown', (e) => {
    if (!state.active || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest('select, input, textarea')) return;
    if (e.key === 'n' && !$<HTMLButtonElement>('quiz-next').disabled) void nextQuiz();
    // Arrow keys step through the engine line currently on the board.
    const current = player.current;
    const line = current && lines.get(current.id);
    if (line && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      player.step(line, e.key === 'ArrowLeft' ? -1 : 1);
    }
    if (e.key === 'h' && state.phase === 'asking') showHint();
  });

  return {
    show(side, scope = 'all') {
      root.hidden = false;
      state.active = true;
      const one = findOpening(scope);
      const newScope = one && one.side === side ? one.id : 'all';
      const changed = side !== state.side || newScope !== state.scope || state.request === 0;
      state.side = side;
      state.scope = newScope;
      renderScopeOptions();
      if (changed) void nextQuiz();
      else renderPanel();
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

