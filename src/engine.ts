// Thin async wrapper around a UCI engine (Stockfish), one request at a time.

/** Evaluation from the side to move's point of view. */
export type Score = { type: 'cp'; value: number } | { type: 'mate'; value: number };

export interface PvLine {
  /** 1-based rank among the engine's candidate lines. */
  rank: number;
  depth: number;
  score: Score;
  /** Principal variation as UCI moves; pv[0] is the candidate move. */
  pv: string[];
}

export interface AnalyseOptions {
  /** Search to this depth... */
  depth?: number;
  /** ...or for this many milliseconds. */
  movetime?: number;
  /** How many candidate moves to return (best first). */
  multiPv?: number;
  /** Restrict the search to these UCI moves. */
  searchMoves?: string[];
  /** Play at roughly this Elo (see ELO_RANGE); omit for full strength. */
  elo?: number;
}

/** The Elo range Stockfish's UCI_LimitStrength is calibrated for. */
export const ELO_RANGE = { min: 1320, max: 3190 } as const;

interface SearchResult {
  lines: PvLine[];
  /** The move the engine chose; with a strength limit this may differ from lines[0]. */
  bestmove: string | null;
}

/** Anything that speaks UCI line by line: a Web Worker, or Stockfish under Node. */
export interface UciTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): void;
}

const MATE = 100_000;

/** Collapse a score to centipawns; mates map to huge values (sooner mate = larger). */
export function scoreToCp(score: Score): number {
  if (score.type === 'cp') return score.value;
  if (score.value === 0) return -MATE; // side to move is checkmated
  return Math.sign(score.value) * (MATE - Math.abs(score.value) * 100);
}

const INFO_RE = {
  depth: / depth (\d+)/,
  multipv: / multipv (\d+)/,
  score: / score (cp|mate) (-?\d+)/,
  pv: / pv (.+)$/,
};

function parseInfo(line: string): PvLine | null {
  if (!line.startsWith('info ') || / (lower|upper)bound/.test(line)) return null;
  const score = INFO_RE.score.exec(line);
  const pv = INFO_RE.pv.exec(line);
  const depth = INFO_RE.depth.exec(line);
  if (!score || !pv || !depth) return null;
  return {
    rank: Number(INFO_RE.multipv.exec(line)?.[1] ?? 1),
    depth: Number(depth[1]),
    score: { type: score[1] as 'cp' | 'mate', value: Number(score[2]) },
    pv: pv[1].trim().split(/\s+/),
  };
}

export class Engine {
  private listeners = new Set<(line: string) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;

  constructor(private transport: UciTransport) {
    transport.onLine((line) => this.listeners.forEach((l) => l(line)));
    this.ready = this.handshake();
  }

  private async handshake(): Promise<void> {
    const ok = this.waitFor((l) => l === 'uciok');
    this.transport.send('uci');
    await ok;
    const ready = this.waitFor((l) => l === 'readyok');
    this.transport.send('isready');
    await ready;
  }

  /** Resolve with the first line matching `done`, feeding every line to `onLine`. */
  private waitFor(done: (line: string) => boolean, onLine?: (line: string) => void): Promise<string> {
    return new Promise((resolve) => {
      const listener = (line: string) => {
        onLine?.(line);
        if (done(line)) {
          this.listeners.delete(listener);
          resolve(line);
        }
      };
      this.listeners.add(listener);
    });
  }

  /** Analyse a FEN position; lines are sorted best first. */
  async analyse(fen: string, options: AnalyseOptions): Promise<PvLine[]> {
    return (await this.search(fen, options)).lines;
  }

  /** The move the engine would play (UCI), or null if there is none (mate/stalemate). */
  async bestMove(fen: string, options: AnalyseOptions): Promise<string | null> {
    return (await this.search(fen, options)).bestmove;
  }

  private search(fen: string, { depth, movetime, multiPv = 1, searchMoves, elo }: AnalyseOptions): Promise<SearchResult> {
    const run = async (): Promise<SearchResult> => {
      await this.ready;
      const lines = new Map<number, PvLine>();
      // Set the strength on every request, so a limited game never weakens an analysis.
      this.transport.send(`setoption name UCI_LimitStrength value ${elo !== undefined}`);
      if (elo !== undefined) {
        const clamped = Math.round(Math.min(ELO_RANGE.max, Math.max(ELO_RANGE.min, elo)));
        this.transport.send(`setoption name UCI_Elo value ${clamped}`);
      }
      this.transport.send(`setoption name MultiPV value ${multiPv}`);
      this.transport.send(`position fen ${fen}`);
      const done = this.waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const info = parseInfo(l);
          if (info) lines.set(info.rank, info);
        },
      );
      const limit = movetime !== undefined ? `movetime ${movetime}` : `depth ${depth ?? 12}`;
      const restrict = searchMoves?.length ? ` searchmoves ${searchMoves.join(' ')}` : '';
      this.transport.send(`go ${limit}${restrict}`);
      const best = (await done).split(/\s+/)[1];
      return {
        lines: [...lines.values()].sort((a, b) => a.rank - b.rank),
        bestmove: best && best !== '(none)' ? best : null,
      };
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

const browserEngines = new Map<string, Engine>();

/**
 * A Stockfish instance running in its own Web Worker (files served from /engine).
 * Separate names get separate engines, so e.g. a game is never queued behind a
 * quiz being prepared in the background.
 */
export function getBrowserEngine(name = 'default'): Engine {
  let engine = browserEngines.get(name);
  if (!engine) {
    const worker = new Worker(`${import.meta.env.BASE_URL}engine/stockfish-19-lite-single.js`);
    engine = new Engine({
      send: (cmd) => worker.postMessage(cmd),
      onLine: (listener) => worker.addEventListener('message', (e: MessageEvent<string>) => listener(String(e.data))),
    });
    browserEngines.set(name, engine);
  }
  return engine;
}
