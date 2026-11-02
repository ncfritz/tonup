import { hitOf, miss, type DartEvent, type Hit, type PlayerRef } from '../darts';
import { fold } from '../games';
import { x01, X01_DEFAULTS } from '../games/x01';

import { x01Stats } from '.';

const A: PlayerRef = { id: 'a', name: 'Alice' };
const T = (n: number) => hitOf(n, 3);
const D = (n: number) => hitOf(n, 2);
const S = (n: number) => hitOf(n, 1);

const events = (hits: Hit[]): DartEvent[] =>
  hits.map((hit, seq) => ({
    id: `${seq}`,
    sessionId: 's',
    playerId: 'a',
    seq,
    point: null,
    hit,
    source: 'keypad',
    precision: 'segment',
    corrected: false,
    at: 0,
  }));

describe('x01Stats', () => {
  it('counts a nine-darter', () => {
    const hits = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];
    const s = x01Stats(fold(x01, { ...X01_DEFAULTS, legs: 2 }, [A], events(hits)), 'a');
    expect(s).toMatchObject({
      darts: 9,
      points: 501,
      average: 167,
      first9Average: 167,
      oneEighties: 2,
      ton40s: 1,
      checkouts: 1,
      checkoutAttempts: 1,
      checkoutRate: 1,
      highestCheckout: 141,
      legsWon: 1,
      bestLeg: 9,
    });
  });

  it('counts busts as nothing and misses at a double as attempts', () => {
    // 101: T20 and 1 leave 40, then a miss | two misses and 20 leave 20 | 20 busts (zero
    // without a double), back to 20 | D10 wins.
    const hits = [T(20), S(1), miss(), miss(), miss(), S(20), S(20), D(10)];
    const s = x01Stats(
      fold(x01, { ...X01_DEFAULTS, startScore: 101, legs: 1 }, [A], events(hits)),
      'a',
    );
    // Every dart from 40 or 20 left is at a one-dart finish: 3 misses, both 20s, and D10.
    expect(s.checkoutAttempts).toBe(6);
    expect(s.checkouts).toBe(1);
    expect(s.highestCheckout).toBe(20);
    expect(s.points).toBe(101);
    expect(s.darts).toBe(8);
    expect(s.average).toBeCloseTo(37.875);
  });

  it('reports no checkout rate without attempts', () => {
    const s = x01Stats(fold(x01, X01_DEFAULTS, [A], events([T(20)])), 'a');
    expect(s.checkoutRate).toBeNull();
    expect(s.bestLeg).toBeNull();
  });
});
