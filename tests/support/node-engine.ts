import { createRequire } from 'node:module';
import { Engine } from '../../src/engine';

interface StockfishModule {
  listener?: (line: string) => void;
  sendCommand(command: string): void;
}

const require = createRequire(import.meta.url);
const initEngine = require('stockfish') as (flavor: string) => Promise<StockfishModule>;

/** Stockfish (lite, single-threaded WASM) running in-process under Node. */
export async function createNodeEngine(): Promise<Engine> {
  const sf = await initEngine('lite-single');
  const listeners: ((line: string) => void)[] = [];
  sf.listener = (line) => listeners.forEach((l) => l(line));
  return new Engine({ send: (cmd) => sf.sendCommand(cmd), onLine: (l) => listeners.push(l) });
}
