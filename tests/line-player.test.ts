import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initial, toFen, type Position } from '../src/chess';
import { LinePlayer, type PlayableLine } from '../src/line-player';

const line: PlayableLine = { id: 'demo', start: initial(), sans: ['e4', 'e5', 'Nf3'] };

describe('LinePlayer', () => {
  let shown: { fen: string; animate: boolean }[];
  let changes: number[];
  let player: LinePlayer;

  beforeEach(() => {
    vi.useFakeTimers();
    shown = [];
    changes = [];
    player = new LinePlayer(
      (pos: Position, _last, animate) => shown.push({ fen: toFen(pos).split(' ')[0], animate }),
      () => changes.push(player.current?.index ?? -1),
      100,
    );
  });
  afterEach(() => vi.useRealTimers());

  it('plays every move from the start, animating each one', () => {
    player.play(line);
    expect(player.current).toEqual({ id: 'demo', index: 0, length: 3, playing: true });
    vi.runAllTimers();
    expect(shown.map((s) => s.animate)).toEqual([false, true, true, true]);
    expect(shown.at(-1)!.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R');
    expect(player.current).toEqual({ id: 'demo', index: 3, length: 3, playing: false });
    // The UI is told about every step, so it can highlight the current move.
    expect(changes).toEqual([0, 1, 2, 3, 3]);
  });

  it('restarts from the beginning when played again', () => {
    player.play(line);
    vi.advanceTimersByTime(250);
    player.play(line);
    expect(player.current!.index).toBe(0);
    expect(shown.at(-1)!.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  });

  it('can start part-way, jump to a move, and stop', () => {
    player.play(line, 2);
    expect(player.current!.index).toBe(2);
    player.jump(line, 1);
    expect(player.current).toEqual({ id: 'demo', index: 1, length: 3, playing: false });
    player.stop();
    expect(player.current).toBeNull();
  });

  it('steps forward and back within a line, clamped at both ends', () => {
    player.step(line, 1); // not on the board yet: starts from the beginning
    expect(player.current).toEqual({ id: 'demo', index: 1, length: 3, playing: false });
    expect(shown.at(-1)!.animate).toBe(true);
    player.step(line, 1);
    player.step(line, -1);
    expect(player.current!.index).toBe(1);
    expect(shown.at(-1)!.animate).toBe(false);
    player.step(line, -5);
    expect(player.current!.index).toBe(0);
    player.step(line, 99);
    expect(player.current!.index).toBe(3);
  });

  it('stops playback when stepping', () => {
    player.play(line);
    vi.advanceTimersByTime(150);
    player.step(line, 1);
    expect(player.current!.playing).toBe(false);
    const index = player.current!.index;
    vi.runAllTimers();
    expect(player.current!.index).toBe(index);
  });
});
