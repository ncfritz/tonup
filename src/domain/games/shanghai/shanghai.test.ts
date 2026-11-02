import { hitOf, miss, type PlayerRef } from '../../darts';
import { playHits } from '../testing';

import { shanghai, SHANGHAI_DEFAULTS } from '.';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const S = (n: number) => hitOf(n, 1);
const D = (n: number) => hitOf(n, 2);
const T = (n: number) => hitOf(n, 3);
const M = miss();

describe('Shanghai', () => {
  it('scores only the round’s number, times the ring', () => {
    const s = playHits(shanghai, SHANGHAI_DEFAULTS, [A], [S(1), T(1), S(20)]);
    expect(s.points).toEqual([4]);
    expect(s.round).toBe(2);
    expect(shanghai.targetFor(s)).toEqual({ segment: 2, multiplier: 3 });
  });

  it('wins at once on a single, double and treble of the number', () => {
    const s = playHits(shanghai, SHANGHAI_DEFAULTS, [A, B], [M, M, M, M, M, M, D(2), S(2), T(2)]);
    expect(shanghai.result(s)?.winnerId).toBe('a');
    expect(s.shanghai).toBe(0);
  });

  it('plays the set number of rounds, highest total winning', () => {
    const s = playHits(
      shanghai,
      { rounds: 2, instantWin: true },
      [A, B],
      [S(1), M, M, T(1), M, M, S(2), M, M, M, M, M],
    );
    expect(s.points).toEqual([3, 3]);
    expect(shanghai.result(s)).toEqual({ winnerId: null, score: { a: 3, b: 3 } });
    const won = playHits(
      shanghai,
      { rounds: 1, instantWin: true },
      [A, B],
      [S(1), M, M, D(1), M, M],
    );
    expect(shanghai.result(won)?.winnerId).toBe('b');
  });

  it('can turn the instant win off', () => {
    const s = playHits(shanghai, { rounds: 7, instantWin: false }, [A], [S(1), D(1), T(1)]);
    expect(s.over).toBe(false);
    expect(s.points).toEqual([6]);
  });
});
