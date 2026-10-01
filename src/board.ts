import {
  colorOf,
  fileOf,
  inCheck,
  isWhite,
  kingSquare,
  legalMoves,
  rankOf,
  type Color,
  type MoveSpec,
  type Piece,
  type Position,
} from './chess';

// Filled glyphs (U+265A..) for every piece; white pieces get the outline glyph
// (U+2654..) layered on top. U+FE0E asks for text rather than emoji rendering.
const TEXT = '︎';
const FILLED: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const OUTLINE: Record<string, string> = { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' };

export interface BoardOptions {
  /** Which colour is at the bottom of the board. */
  bottom: Color;
  /** Highlight this move's squares. */
  lastMove?: MoveSpec;
  /** Slide the last move's piece into place. */
  animate?: boolean;
  /** Squares to emphasise, e.g. for a hint. */
  marks?: number[];
  /** Arrows drawn over the board; `kind` becomes a CSS class (e.g. "book"). */
  arrows?: { from: number; to: number; kind: string }[];
  /** Let the user move pieces of `color` (when it is that side's turn). */
  interactive?: {
    color: Color;
    onMove(move: MoveSpec, info: { dragged: boolean }): void;
  };
}

interface DragState {
  piece: HTMLElement;
  from: number;
  startX: number;
  startY: number;
  moved: boolean;
}

// Board square index for a display cell (row 0 = top, col 0 = left).
function squareAt(row: number, col: number, bottom: Color): number {
  return bottom === 'w' ? (7 - row) * 8 + col : row * 8 + (7 - col);
}

// Centre of a square in the arrow overlay's coordinates (100 units per square).
function squareCentre(sq: number, bottom: Color): [number, number] {
  const col = bottom === 'w' ? fileOf(sq) : 7 - fileOf(sq);
  const row = bottom === 'w' ? 7 - rankOf(sq) : rankOf(sq);
  return [col * 100 + 50, row * 100 + 50];
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * An arrow from the centre of one square to (just short of) the centre of another.
 * Knight moves are drawn as an L: along the two-square leg, then a right-angle turn.
 */
function arrowElement(from: number, to: number, kind: string, bottom: Color): SVGGElement {
  const [x1, y1] = squareCentre(from, bottom);
  const [x2, y2] = squareCentre(to, bottom);
  const knight = Math.abs(fileOf(to) - fileOf(from)) * Math.abs(rankOf(to) - rankOf(from)) === 2;
  // Corner of the L: the long (two-square) leg comes first.
  const corner: [number, number] | null = knight
    ? Math.abs(x2 - x1) > Math.abs(y2 - y1) ? [x2, y1] : [x1, y2]
    : null;

  const unit = ([ax, ay]: number[], [bx, by]: number[]) => {
    const len = Math.hypot(bx - ax, by - ay);
    return [(bx - ax) / len, (by - ay) / len];
  };
  const first = corner ?? [x2, y2];
  const [sx, sy] = unit([x1, y1], first); // direction of the first leg
  const [ux, uy] = unit(corner ?? [x1, y1], [x2, y2]); // direction into the target
  const head = 40;
  const half = 26;
  const [bx, by] = [x2 - ux * head, y2 - uy * head]; // base of the arrowhead

  const points = [[x1 + sx * 20, y1 + sy * 20], ...(corner ? [corner] : []), [bx, by]];
  const shaft = document.createElementNS(SVG_NS, 'polyline');
  shaft.setAttribute('points', points.map((p) => p.join(',')).join(' '));

  const tip = document.createElementNS(SVG_NS, 'polygon');
  tip.setAttribute(
    'points',
    [
      [x2, y2],
      [bx - uy * half, by + ux * half],
      [bx + uy * half, by - ux * half],
    ]
      .map((p) => p.join(','))
      .join(' '),
  );

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `arrow ${kind}${knight ? ' knight' : ''}`);
  g.append(shaft, tip);
  return g;
}

function pieceElement(p: Piece): HTMLElement {
  const piece = document.createElement('span');
  const kind = p.toLowerCase();
  piece.className = `piece ${isWhite(p) ? 'w' : 'b'}`;
  piece.textContent = FILLED[kind] + TEXT;
  if (isWhite(p)) piece.dataset.outline = OUTLINE[kind] + TEXT;
  return piece;
}

/** Renders positions into an element; optionally lets the user click or drag moves. */
export class BoardView {
  private pos: Position | null = null;
  private opts: BoardOptions = { bottom: 'w' };
  private cells = new Map<number, HTMLElement>();
  private selected: number | null = null;
  private targets: MoveSpec[] = [];
  private drag: DragState | null = null;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', () => this.endDrag());
  }

  render(pos: Position, opts: BoardOptions): void {
    this.pos = pos;
    this.opts = opts;
    this.selected = null;
    this.targets = [];
    this.endDrag();
    this.draw(opts.animate ?? false);
  }

  private get canMove(): boolean {
    const inter = this.opts.interactive;
    return !!inter && !!this.pos && this.pos.turn === inter.color;
  }

  private draw(animate: boolean): void {
    const pos = this.pos;
    if (!pos) return;
    const { bottom, lastMove, marks = [] } = this.opts;
    const checkSq = inCheck(pos) ? kingSquare(pos.board, pos.turn) : -1;
    const targetSquares = new Set(this.targets.map((t) => t.to));
    this.el.classList.toggle('interactive', this.canMove);
    this.cells.clear();
    this.el.replaceChildren();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const sq = squareAt(row, col, bottom);
        const cell = document.createElement('div');
        const light = (fileOf(sq) + rankOf(sq)) % 2 === 1;
        cell.className = `sq ${light ? 'light' : 'dark'}`;
        if (lastMove && (sq === lastMove.from || sq === lastMove.to)) cell.classList.add('hl');
        if (sq === checkSq) cell.classList.add('check');
        if (sq === this.selected) cell.classList.add('selected');
        if (marks.includes(sq)) cell.classList.add('mark');
        if (targetSquares.has(sq)) cell.classList.add(pos.board[sq] ? 'target-capture' : 'target');
        cell.dataset.sq = String(sq);
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);

        if (col === 0) cell.insertAdjacentHTML('beforeend', `<span class="coord rank">${rankOf(sq) + 1}</span>`);
        if (row === 7) cell.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[fileOf(sq)]}</span>`);

        const p = pos.board[sq];
        if (p) {
          const piece = pieceElement(p);
          if (this.canMove && colorOf(p) === this.opts.interactive!.color) piece.classList.add('mine');
          cell.appendChild(piece);
        }
        this.cells.set(sq, cell);
        this.el.appendChild(cell);
      }
    }

    const { arrows = [] } = this.opts;
    if (arrows.length) {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'arrows');
      svg.setAttribute('viewBox', '0 0 800 800');
      svg.setAttribute('aria-hidden', 'true');
      svg.append(...arrows.map((a) => arrowElement(a.from, a.to, a.kind, bottom)));
      this.el.appendChild(svg);
    }

    if (animate && lastMove) this.slide(lastMove);
  }

  // Slide the moved piece (and the rook, when castling) into place.
  private slide({ from, to }: MoveSpec): void {
    this.slidePiece(from, to);
    const king = this.pos?.board[to];
    if (king && king.toUpperCase() === 'K' && Math.abs(to - from) === 2) {
      const kingside = to > from;
      this.slidePiece(kingside ? from + 3 : from - 4, kingside ? from + 1 : from - 1);
    }
  }

  private slidePiece(from: number, to: number): void {
    const fromCell = this.cells.get(from)!;
    const toCell = this.cells.get(to)!;
    const piece = toCell.querySelector<HTMLElement>('.piece');
    if (!piece || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = (Number(fromCell.dataset.col) - Number(toCell.dataset.col)) * 100;
    const dy = (Number(fromCell.dataset.row) - Number(toCell.dataset.row)) * 100;
    piece.style.transform = `translate(${dx}%, ${dy}%)`;
    piece.getBoundingClientRect(); // force reflow before transitioning
    piece.classList.add('moving');
    piece.style.transform = '';
    piece.addEventListener('transitionend', () => piece.classList.remove('moving'), { once: true });
  }

  // ── Interaction: click-click or drag-and-drop ──────────────────────
  private squareAtPoint(x: number, y: number): number | null {
    const cell = document.elementFromPoint(x, y)?.closest<HTMLElement>('.sq');
    return cell && this.el.contains(cell) ? Number(cell.dataset.sq) : null;
  }

  private select(sq: number | null): void {
    this.selected = sq;
    this.targets = sq === null || !this.pos ? [] : legalMoves(this.pos).filter((m) => m.from === sq);
    this.draw(false);
  }

  /** Play the selected piece to `sq` if legal (promotions default to a queen). */
  private tryMove(sq: number, dragged: boolean): boolean {
    const options = this.targets.filter((t) => t.to === sq);
    const move = options.find((t) => !t.promo || t.promo === 'Q');
    if (!move) return false;
    this.selected = null;
    this.targets = [];
    this.opts.interactive!.onMove(move, { dragged });
    return true;
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.canMove || e.button !== 0) return;
    const sq = this.squareAtPoint(e.clientX, e.clientY);
    if (sq === null) return;
    if (this.selected !== null && this.tryMove(sq, false)) return;

    const p = this.pos!.board[sq];
    if (!p || colorOf(p) !== this.opts.interactive!.color) {
      if (this.selected !== null) this.select(null);
      return;
    }
    e.preventDefault();
    this.select(sq);
    const piece = this.cells.get(sq)?.querySelector<HTMLElement>('.piece');
    if (!piece) return;
    this.drag = { piece, from: sq, startX: e.clientX, startY: e.clientY, moved: false };
    piece.classList.add('dragging');
    this.el.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    drag.piece.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  private onPointerUp = (e: PointerEvent): void => {
    const drag = this.drag;
    if (!drag) return;
    const sq = this.squareAtPoint(e.clientX, e.clientY);
    this.endDrag();
    // A click (no drag) leaves the piece selected for a click on the target square.
    if (drag.moved && sq !== null && sq !== drag.from && !this.tryMove(sq, true)) this.select(null);
  };

  private endDrag(): void {
    if (!this.drag) return;
    this.drag.piece.classList.remove('dragging');
    this.drag.piece.style.transform = '';
    this.drag = null;
  }
}
