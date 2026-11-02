import { STEEL_TIP_RADII_MM } from '../board';
import { label } from '../darts';

import { BOT_LEVELS, botLevel, scatter, seeded, simulateAverage, throwAt } from '.';

describe('rng', () => {
  it('repeats for the same seed', () => {
    const a = seeded(1);
    const b = seeded(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('scatter', () => {
  it('spreads around the aim with the given sigma', () => {
    const rng = seeded(3);
    const pts = Array.from({ length: 4000 }, () => scatter({ x: 0, y: 103 }, 10, rng));
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    const mx = mean(pts.map((p) => p.x));
    const my = mean(pts.map((p) => p.y));
    const sd = Math.sqrt(mean(pts.map((p) => (p.x - mx) ** 2)));
    expect(mx).toBeCloseTo(0, 0);
    expect(my).toBeCloseTo(103, 0);
    expect(sd).toBeGreaterThan(9.5);
    expect(sd).toBeLessThan(10.5);
  });

  it('hits the target every time with no scatter', () => {
    const rng = seeded(5);
    expect(label(throwAt({ segment: 20, multiplier: 3 }, 0, rng).hit)).toBe('T20');
    expect(label(throwAt({ segment: 25, multiplier: 2 }, 0, rng).hit)).toBe('Bull');
  });

  it('can miss the board entirely', () => {
    const rng = seeded(9);
    const far = Array.from({ length: 500 }, () => throwAt({ segment: 20, multiplier: 2 }, 30, rng));
    expect(far.some((d) => d.hit.ring === 'miss')).toBe(true);
    expect(
      far.every(
        (d) =>
          d.hit.ring !== 'miss' ||
          Math.hypot(d.point.x, d.point.y) > STEEL_TIP_RADII_MM.doubleOuter,
      ),
    ).toBe(true);
  });
});

describe('bot levels', () => {
  it('get steadily tighter from level 1 to 5', () => {
    const sigmas = BOT_LEVELS.map((l) => l.sigma);
    expect([...sigmas].sort((a, b) => b - a)).toEqual(sigmas);
    expect(() => botLevel(6)).toThrow(RangeError);
  });

  // The plan's done-when for M1: each level averages within ±3 of its target.
  it.each(BOT_LEVELS.map((l) => [l.level, l.targetAverage, l.sigma] as const))(
    'level %i averages about %i',
    (_level, target, sigma) => {
      const avg = simulateAverage(sigma, 400, seeded(2026));
      expect(Math.abs(avg - target)).toBeLessThanOrEqual(3);
    },
  );
});
