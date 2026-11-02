import { hitOf, miss, type PlayerRef } from '../../darts';
import { playHits } from '../testing';

import { clock, CLOCK_DEFAULTS } from '.';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const S = (n: number) => hitOf(n, 1);
const D = (n: number) => hitOf(n, 2);
const T = (n: number) => hitOf(n, 3);
const M = miss();
const run = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => S(from + i));

describe('Around the Clock', () => {
  it('moves on only for the current number', () => {
    const s = playHits(clock, CLOCK_DEFAULTS, [A], [S(1), S(3), S(2)]);
    expect(s.next[0]).toBe(2);
    expect(clock.view(s).rows[0]!.note).toBe('3');
  });

  it('finishes on the bull and stops the game there', () => {
    const s = playHits(clock, CLOCK_DEFAULTS, [A], [...run(1, 20), hitOf(25, 1)]);
    expect(clock.result(s)?.winnerId).toBe('a');
    expect(clock.currentPlayer(s)).toBeNull();
  });

  it('passes the throw after three darts', () => {
    const s = playHits(clock, CLOCK_DEFAULTS, [A, B], [S(1), M, M, S(1)]);
    expect(s.next).toEqual([1, 1]);
  });

  it('counts only doubles in doubles mode, and needs the inner bull', () => {
    const settings = { ...CLOCK_DEFAULTS, ring: 'doubles' as const };
    expect(playHits(clock, settings, [A], [S(1), T(1), D(1)]).next[0]).toBe(1);
    expect(clock.targetFor(clock.init(settings, [A]))).toEqual({ segment: 1, multiplier: 2 });
  });

  it('skips ahead on doubles and trebles, but not past 20 onto the bull', () => {
    const settings = { ...CLOCK_DEFAULTS, skip: true };
    expect(playHits(clock, settings, [A], [T(1)]).next[0]).toBe(3);
    const late = playHits(clock, settings, [A], [...run(1, 18), M, T(19)]);
    expect(late.next[0]).toBe(20);
    expect(clock.targetFor(late)).toEqual({ segment: 25, multiplier: 1 });
  });

  it('ends at 20 without the bull when the bull is off', () => {
    const s = playHits(clock, { ...CLOCK_DEFAULTS, bull: false }, [A], run(1, 20));
    expect(clock.result(s)?.winnerId).toBe('a');
  });
});
