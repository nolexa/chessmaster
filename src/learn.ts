// Learn mode: pick an opening and variation, and watch the line play out.
import { BoardView } from './board';
import { replay, type Color, type Move, type Position } from './chess';
import { findOpening, groupOpenings, openingsFor, sanList, type Opening } from './openings';
import { $ } from './dom';

export interface LearnView {
  /** Show learn mode for `side`, optionally at a specific opening/variation. */
  show(side: Color, openingId?: string, variation?: number): void;
  hide(): void;
  readonly opening: Opening;
}

export function createLearnView(): LearnView {
  const root = $('learn-view');
  const board = new BoardView($('board'));
  const state = {
    active: false,
    side: 'w' as Color,
    opening: openingsFor('w')[0],
    variation: 0,
    ply: 0,
    positions: [] as Position[],
    moves: [] as Move[],
    flipped: false,
    timer: null as ReturnType<typeof setTimeout> | null,
  };

  const currentVariation = () => state.opening.variations[state.variation];

  // ── Selection ──────────────────────────────────────────────────────
  function selectOpening(opening: Opening): void {
    state.opening = opening;
    selectVariation(0);
  }

  function selectVariation(index: number): void {
    stop();
    state.variation = index;
    const line = replay(sanList(currentVariation()));
    state.positions = line.positions;
    state.moves = line.moves;
    state.ply = 0;
    history.replaceState(null, '', `#${state.side === 'w' ? 'white' : 'black'}/${state.opening.id}/${index + 1}`);
    renderSidebar();
    renderInfo();
    renderPosition(false);
  }

  // ── Navigation ─────────────────────────────────────────────────────
  function goTo(ply: number): void {
    const target = Math.max(0, Math.min(ply, state.moves.length));
    if (target === state.ply) return;
    const animate = target === state.ply + 1;
    state.ply = target;
    renderPosition(animate);
  }

  function play(): void {
    if (state.ply >= state.moves.length) goTo(0);
    const tick = () => {
      if (state.ply >= state.moves.length) return stop();
      goTo(state.ply + 1);
      state.timer = setTimeout(tick, Number($<HTMLSelectElement>('speed').value));
    };
    state.timer = setTimeout(tick, state.ply === 0 ? 350 : 0);
    renderControls();
  }

  function stop(): void {
    if (state.timer) clearTimeout(state.timer);
    state.timer = null;
    renderControls();
  }

  const togglePlay = () => (state.timer ? stop() : play());

  // ── Rendering ──────────────────────────────────────────────────────
  function renderSidebar(): void {
    const item = (o: Opening) => listItem(o.name, o.eco, o === state.opening, () => selectOpening(o));
    const expanded = loadExpanded(state.side);
    $('openings').replaceChildren(
      ...groupOpenings(state.side).map((g) => {
        // The group holding the selected opening is always open; others as the user left them.
        const open = g.openings.includes(state.opening) || expanded.has(g.label);
        return collapsibleGroup(g.label, g.openings.map(item), open, (isOpen) => {
          const now = loadExpanded(state.side);
          if (isOpen) now.add(g.label);
          else now.delete(g.label);
          saveExpanded(state.side, now);
        });
      }),
    );

    $('variations').replaceChildren(
      ...state.opening.variations.map((v, i) => {
        const moves = Math.ceil(sanList(v).length / 2);
        return listItem(v.name, `${moves} moves`, i === state.variation, () => selectVariation(i));
      }),
    );
  }

  function renderInfo(): void {
    const o = state.opening;
    const v = currentVariation();
    $('opening-title').textContent = o.name;
    $('variation-title').textContent = `${v.name} · ${o.eco}`;
    $('summary').textContent = o.summary;
    $('idea').textContent = v.idea;
  }

  function orientation(): Color {
    const blackBottom = (state.side === 'b') !== state.flipped;
    return blackBottom ? 'b' : 'w';
  }

  function renderPosition(animate: boolean): void {
    board.render(state.positions[state.ply], {
      bottom: orientation(),
      lastMove: state.moves[state.ply - 1],
      animate,
    });
    renderMoveList();
    renderControls();
    renderStatus();
  }

  function renderMoveList(): void {
    const list = $('movelist');
    list.replaceChildren();
    for (let i = 0; i < state.moves.length; i += 2) {
      const li = document.createElement('li');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = `${i / 2 + 1}.`;
      li.appendChild(num);
      for (const idx of [i, i + 1]) {
        const m = state.moves[idx];
        if (!m) {
          li.appendChild(document.createElement('span'));
          continue;
        }
        const btn = document.createElement('button');
        btn.textContent = m.san;
        if (m.color === state.side) btn.classList.add('you');
        if (idx === state.ply - 1) btn.classList.add('current');
        btn.addEventListener('click', () => {
          stop();
          goTo(idx + 1);
        });
        li.appendChild(btn);
      }
      list.appendChild(li);
    }

    // Keep the current move visible without scrolling the page itself.
    const current = list.querySelector<HTMLElement>('.current');
    if (current) {
      const top = current.offsetTop;
      if (top < list.scrollTop || top + current.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = top - list.clientHeight / 2;
      }
    }
  }

  function renderStatus(): void {
    const total = state.moves.length;
    let text: string;
    if (state.ply === 0) text = 'Starting position';
    else if (state.ply === total) text = 'End of line';
    else {
      const m = state.moves[state.ply - 1];
      text = `${Math.ceil(state.ply / 2)}${m.color === 'w' ? '.' : '…'} ${m.san}`;
    }
    const toMove = state.positions[state.ply].turn === state.side ? 'Your move next' : 'Opponent to move';
    const line1 = document.createElement('div');
    line1.textContent = text;
    const line2 = document.createElement('div');
    line2.textContent = state.ply < total ? toMove : `${total} plies`;
    $('status').replaceChildren(line1, line2);
    $('progress-bar').style.width = `${(state.ply / total) * 100}%`;
  }

  function renderControls(): void {
    const atStart = state.ply === 0;
    const atEnd = state.ply >= state.moves.length;
    $<HTMLButtonElement>('btn-start').disabled = atStart;
    $<HTMLButtonElement>('btn-prev').disabled = atStart;
    $<HTMLButtonElement>('btn-next').disabled = atEnd;
    $<HTMLButtonElement>('btn-end').disabled = atEnd;
    $('btn-play').textContent = state.timer ? '❚❚ Pause' : atEnd ? '↻ Replay' : '▶ Play';
  }

  // ── Wiring ─────────────────────────────────────────────────────────
  const stepTo = (ply: () => number) => () => {
    stop();
    goTo(ply());
  };
  const toStart = stepTo(() => 0);
  const toPrev = stepTo(() => state.ply - 1);
  const toNext = stepTo(() => state.ply + 1);
  const toEnd = stepTo(() => state.moves.length);
  const flip = () => {
    state.flipped = !state.flipped;
    renderPosition(false);
  };

  $('btn-start').addEventListener('click', toStart);
  $('btn-prev').addEventListener('click', toPrev);
  $('btn-next').addEventListener('click', toNext);
  $('btn-end').addEventListener('click', toEnd);
  $('btn-play').addEventListener('click', togglePlay);
  $('btn-flip').addEventListener('click', flip);

  const KEYS: Record<string, () => void> = {
    ArrowLeft: toPrev,
    ArrowRight: toNext,
    Home: toStart,
    End: toEnd,
    ' ': togglePlay,
    f: flip,
  };

  document.addEventListener('keydown', (e) => {
    if (!state.active) return;
    const inField = e.target instanceof Element && e.target.closest('select, input, textarea');
    if (inField || e.metaKey || e.ctrlKey || e.altKey) return;
    const action = KEYS[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  });

  return {
    show(side, openingId, variation = 1) {
      state.active = true;
      root.hidden = false;
      const opening = findOpening(openingId ?? '');
      const newSide = opening?.side ?? side;
      if (newSide !== state.side) state.flipped = false;
      state.side = newSide;
      if (opening) {
        state.opening = opening;
        selectVariation(Math.min(Math.max(variation - 1, 0), opening.variations.length - 1));
      } else if (state.opening.side !== newSide) {
        selectOpening(openingsFor(newSide)[0]);
      } else {
        selectVariation(state.variation);
      }
    },
    hide() {
      stop();
      state.active = false;
      root.hidden = true;
    },
    get opening() {
      return state.opening;
    },
  };
}

export function listItem(label: string, meta: string, current: boolean, onClick: () => void): HTMLLIElement {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.setAttribute('aria-current', String(current));
  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  const metaEl = document.createElement('span');
  metaEl.className = 'meta';
  metaEl.textContent = meta;
  btn.append(labelEl, metaEl);
  btn.addEventListener('click', onClick);
  li.appendChild(btn);
  return li;
}

const EXPANDED_KEY = 'chessmaster.learn.expanded.v1';

/** Opening groups the user has opened, per side (the selected opening's group is always open). */
function loadExpanded(side: Color): Set<string> {
  try {
    const all = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '{}') as Partial<Record<Color, string[]>>;
    return new Set(all[side] ?? []);
  } catch {
    return new Set();
  }
}

function saveExpanded(side: Color, labels: Set<string>): void {
  try {
    const all = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '{}') as Partial<Record<Color, string[]>>;
    all[side] = [...labels];
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: groups just won't stay open across reloads.
  }
}

/** A collapsible group of list items: "▸ 1.e4 · 6". */
function collapsibleGroup(label: string, items: HTMLLIElement[], open: boolean, onToggle: (open: boolean) => void): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'list-group';
  const details = document.createElement('details');
  details.open = open;
  const summary = document.createElement('summary');
  const name = document.createElement('span');
  name.textContent = label;
  const count = document.createElement('span');
  count.className = 'count';
  count.textContent = String(items.length);
  summary.append(name, count);
  const list = document.createElement('ul');
  list.className = 'list';
  list.append(...items);
  details.append(summary, list);
  // Record only user clicks (also fired by Enter/Space): setting `open` while
  // rendering fires 'toggle' too, which must not count as the user's choice.
  summary.addEventListener('click', () => onToggle(!details.open));
  li.append(details);
  return li;
}
