import { hitOf, miss, type PlayerRef } from '../darts';
import { CLOCK_DEFAULTS } from '../games/clock';
import { playHits } from '../games/testing';

import { beats, drills } from '.';

const ME: PlayerRef = { id: 'you', name: 'You' };
const D = (n: number) => hitOf(n, 2);
const M = miss();

describe("Bob's 27", () => {
  const { bobs27 } = drills;

  it('adds each hit double and takes the double away for a blank round', () => {
    // D1: one hit (+2) → 29. D2: blank (−4) → 25. D3: two hits (+12) → 37.
    const s = playHits(bobs27, {}, [ME], [D(1), M, M, M, M, M, D(3), D(3), M]);
    expect(s.score).toBe(37);
    expect(bobs27.targetFor(s)).toEqual({ segment: 4, multiplier: 2 });
    expect(
      bobs27
        .steps(s)
        .slice(0, 4)
        .map((x) => x.state),
    ).toEqual(['done', 'missed', 'done', 'current']);
  });

  it('ends at zero or below', () => {
    // 27 −2 −4 −6 −8 = 7, −10 → −3: over after D5.
    const blanks = Array.from({ length: 15 }, () => M);
    const s = playHits(bobs27, {}, [ME], blanks);
    expect(s.over).toBe(true);
    expect(bobs27.failed(s)).toBe(true);
    expect(bobs27.score(s)).toBe(-3);
    expect(bobs27.result(s)).toEqual({ winnerId: 'you', score: { you: -3 } });
    expect(bobs27.stats(s, 'you')).toEqual(
      expect.arrayContaining([{ key: 'costliestDouble', value: 5, format: 'int' }]),
    );
  });

  it('finishes after the bull, which is worth 50', () => {
    // One hit on every double D1–D20, two misses each, then a bull.
    const hits = Array.from({ length: 20 }, (_, i) => [D(i + 1), M, M]).flat();
    const s = playHits(bobs27, {}, [ME], [...hits, hitOf(25, 2), M, M]);
    // 27 + 2×(1+…+20) + 50 = 27 + 420 + 50.
    expect(s.score).toBe(497);
    expect(s.over).toBe(true);
    expect(bobs27.failed(s)).toBe(false);
  });

  it('is for one player', () => {
    expect(() => bobs27.init({}, [ME, { id: 'x', name: 'X' }])).toThrow();
  });
});

describe('Count Up', () => {
  const { countUp } = drills;
  it('adds everything over the set number of visits', () => {
    const s = playHits(
      countUp,
      { visits: 2 },
      [ME],
      [hitOf(20, 3), hitOf(20, 1), M, hitOf(25, 2), hitOf(5, 1), M],
    );
    expect(s.score).toBe(135);
    expect(s.over).toBe(true);
    expect(countUp.steps(s).map((x) => x.value)).toEqual([80, 55]);
  });
});

describe('Around the Clock drill', () => {
  const { clock } = drills;
  it('scores darts to finish, lower being better', () => {
    const run = [...Array.from({ length: 20 }, (_, i) => hitOf(i + 1, 1)), M, hitOf(25, 1)];
    const s = playHits(clock, CLOCK_DEFAULTS, [ME], run);
    expect(clock.result(s)).toEqual({ winnerId: 'you', score: { you: 22 } });
    expect(clock.better).toBe('lower');
    expect(beats('lower', 20, 22)).toBe(true);
    expect(beats('higher', 20, 22)).toBe(false);
  });
});
