// Plays a sequence of SAN moves on a board, one move at a time.
import { play, type Move, type MoveSpec, type Position } from './chess';

export interface PlayableLine {
  /** Identifies the line in the UI (for highlighting the current move). */
  id: string;
  start: Position;
  /** Move that led to `start`, highlighted before the first move is played. */
  startLastMove?: MoveSpec;
  sans: string[];
}

interface Loaded {
  line: PlayableLine;
  positions: Position[];
  moves: Move[];
}

export type ShowPosition = (position: Position, lastMove: MoveSpec | undefined, animate: boolean) => void;

export class LinePlayer {
  private loaded: Loaded | null = null;
  private index = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * @param show draws a position on the board
   * @param onChange called whenever the current line, move or playing state changes
   */
  constructor(
    private show: ShowPosition,
    private onChange: () => void,
    private stepMs = 900,
  ) {}

  /** Line id, moves played so far (0 = start position), line length, and whether it is still playing. */
  get current(): { id: string; index: number; length: number; playing: boolean } | null {
    if (!this.loaded) return null;
    return { id: this.loaded.line.id, index: this.index, length: this.loaded.moves.length, playing: this.timer !== null };
  }

  /** Play `line` from move `from` (0 = its start position) to the end. */
  play(line: PlayableLine, from = 0): void {
    this.load(line, from);
    const tick = () => {
      if (!this.loaded || this.index >= this.loaded.moves.length) {
        this.timer = null;
        this.onChange();
        return;
      }
      this.index++;
      this.draw(true);
      this.timer = setTimeout(tick, this.stepMs);
      this.onChange();
    };
    this.timer = setTimeout(tick, from === 0 ? this.stepMs / 2 : this.stepMs);
    this.onChange();
  }

  /** Stop and show the position after `index` moves of `line`. */
  jump(line: PlayableLine, index: number): void {
    this.load(line, index);
    this.onChange();
  }

  /**
   * Step `delta` moves through `line` (stopping any playback). A line that is
   * not on the board yet starts from its beginning. Single steps forward animate.
   */
  step(line: PlayableLine, delta: number): void {
    const from = this.loaded?.line.id === line.id ? this.index : 0;
    this.load(line, from);
    const target = Math.max(0, Math.min(from + delta, this.loaded!.moves.length));
    if (target !== this.index) {
      const animate = target === this.index + 1;
      this.index = target;
      this.draw(animate);
    }
    this.onChange();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.loaded = null;
    this.onChange();
  }

  private load(line: PlayableLine, index: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const positions = [line.start];
    const moves: Move[] = [];
    for (const san of line.sans) {
      const r = play(positions[positions.length - 1], san);
      positions.push(r.position);
      moves.push(r.move);
    }
    this.loaded = { line, positions, moves };
    this.index = Math.max(0, Math.min(index, moves.length));
    this.draw(false);
  }

  private draw(animate: boolean): void {
    const { line, positions, moves } = this.loaded!;
    const lastMove = this.index ? moves[this.index - 1] : line.startLastMove;
    this.show(positions[this.index], lastMove, animate);
  }
}
