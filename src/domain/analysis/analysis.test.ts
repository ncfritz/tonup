import { centreOf, hitAt } from '../board';
import { seeded, simulateAverage, simulateWith, throwAt } from '../bot';
import { BULL, hitOf, type DartEvent, type Point, type Target } from '../darts';

import {
  aimMap,
  aimOffsets,
  compass,
  expectedScore,
  fitGhost,
  fitSigma,
  ghostFromAverage,
  ghostId,
  ghostThrow,
  grouping,
  inGroup,
  nearestLevel,
  offsetGrid,
  parseGhost,
  sigmaForAverage,
  weeklyTrends,
  WEEK_MS,
  type Offset,
} from '.';

const T20: Target = { segment: 20, multiplier: 3 };

const dart = (
  point: Point | null,
  intended: Target,
  extra: Partial<DartEvent> = {},
): DartEvent => ({
  id: 'd',
  sessionId: 's',
  playerId: 'you',
  seq: 0,
  point,
  hit: hitOf(20, 1),
  intended,
  source: 'tap',
  precision: 'exact',
  corrected: false,
  at: 0,
  ...extra,
});
const off = (dx: number, dy: number, target: Target = T20): Offset => ({ dx, dy, target, at: 0 });

describe('aim-relative offsets', () => {
  it('measures from the middle of the target, leaving out keypad and bot darts', () => {
    const c = centreOf(T20);
    const darts = [
      dart({ x: c.x + 3, y: c.y - 4 }, T20),
      dart(null, T20, { precision: 'segment', source: 'keypad' }),
      dart({ x: c.x, y: c.y }, T20, { source: 'bot' }),
    ];
    const o = aimOffsets(darts);
    expect(o).toHaveLength(1);
    expect(o[0]!.dx).toBeCloseTo(3);
    expect(o[0]!.dy).toBeCloseTo(-4);
  });

  it('groups targets', () => {
    expect(inGroup(T20, 't20')).toBe(true);
    expect(inGroup({ segment: 16, multiplier: 2 }, 'doubles')).toBe(true);
    expect(inGroup({ segment: BULL, multiplier: 2 }, 'doubles')).toBe(false);
    expect(inGroup({ segment: BULL, multiplier: 2 }, 'bull')).toBe(true);
  });
});

describe('grouping and drift', () => {
  it('matches a hand-computed fixture', () => {
    // Four darts at (−2, −6), (2, −6), (−2, −2), (2, −2): mean (0, −4), each axis s = √(16/3).
    const g = grouping([off(-2, -6), off(2, -6), off(-2, -2), off(2, -2)])!;
    expect(g.mean).toEqual({ x: 0, y: -4 });
    expect(g.sx).toBeCloseTo(Math.sqrt(16 / 3));
    expect(g.sy).toBeCloseTo(Math.sqrt(16 / 3));
    expect(g.rho).toBeCloseTo(0);
    // Every dart is √8 from the mean.
    expect(g.r50).toBeCloseTo(Math.sqrt(8));
    // 4 mm low beats both thresholds (3 mm and a quarter of σ ≈ 0.58).
    expect(g.drift).toEqual({ mm: 4, direction: 'down' });
  });

  it('calls small drift none, and names directions', () => {
    const g = grouping([off(-10, 0), off(10, 1), off(0, 10), off(0, -10)])!;
    expect(g.drift.direction).toBe('none');
    expect(compass(-1, -1)).toBe('downLeft');
    expect(compass(1, 0.1)).toBe('right');
  });

  it('bins offsets on a grid around the aim', () => {
    const grid = offsetGrid([off(0, 0), off(8, 0), off(0, 8), off(100, 0)], 8, 2);
    expect(grid.counts[2]![2]).toBe(1);
    expect(grid.counts[2]![3]).toBe(1);
    expect(grid.counts[1]![2]).toBe(1);
    expect(grid.outside).toBe(1);
  });
});

describe('aim map', () => {
  it('fits σ as the circular MLE', () => {
    // Σ(dx²+dy²) = 25 + 0 + 25 + 25 = 75 over 2n = 8.
    expect(fitSigma([off(3, 4), off(0, 0), off(-3, -4), off(0, 5)])).toBeCloseTo(Math.sqrt(75 / 8));
  });

  it('aims at T20 with a tight grouping and nearer the middle with a wide one', () => {
    expect(expectedScore(centreOf(T20), 0)).toBe(60);
    expect(expectedScore({ x: 0, y: 0 }, 0)).toBe(50);
    const tight = aimMap(2);
    expect(tight.best.score).toBeGreaterThan(55);
    expect(hitAt(tight.best.point)).toMatchObject({ segment: 20, multiplier: 3 });
    // Tibshirani et al.: a middling grouping does better at T19 and T16, down and to the left…
    const mid = aimMap(25);
    expect(mid.best.point.y).toBeLessThan(-60);
    expect(mid.best.point.x).toBeLessThan(0);
    expect(mid.best.score).toBeGreaterThan(mid.t20);
    // …and a very wide one near the middle of the board.
    const wide = aimMap(100);
    expect(Math.hypot(wide.best.point.x, wide.best.point.y)).toBeLessThan(70);
    expect(wide.best.score).toBeGreaterThan(wide.t20);
  });
});

describe('the ghost bot', () => {
  it('recovers a scatter from offsets, and stores it in the player id', () => {
    const rng = seeded(7);
    const truth = { dx: -4, dy: 2, sx: 14, sy: 9, rho: 0.3 };
    const offsets = Array.from({ length: 4000 }, () => {
      const p = ghostThrow(T20, truth, rng).point;
      const c = centreOf(T20);
      return off(p.x - c.x, p.y - c.y);
    });
    const fit = fitGhost(offsets)!;
    expect(fit.dx).toBeCloseTo(-4, 0);
    expect(fit.dy).toBeCloseTo(2, 0);
    expect(fit.sx).toBeCloseTo(14, 0);
    expect(fit.sy).toBeCloseTo(9, 0);
    expect(fit.rho).toBeCloseTo(0.3, 1);
    expect(parseGhost(ghostId(fit, '2026-10'))).toEqual({
      dx: Math.round(fit.dx * 10) / 10,
      dy: Math.round(fit.dy * 10) / 10,
      sx: Math.round(fit.sx * 10) / 10,
      sy: Math.round(fit.sy * 10) / 10,
      rho: Math.round(fit.rho * 100) / 100,
    });
    expect(parseGhost('bot-3')).toBeNull();
    expect(fitGhost(offsets.slice(0, 10))).toBeNull();
  });

  it('averages what the player averaged, fitted from their darts', () => {
    // A player who throws like scatter 12: play legs, keep their offsets, fit, play the ghost.
    const rng = seeded(11);
    const offsets: Offset[] = [];
    const player = simulateWith((t) => {
      const r = throwAt(t, 12, rng);
      const c = centreOf(t);
      offsets.push(off(r.point.x - c.x, r.point.y - c.y, t));
      return r;
    }, 60);
    const ghost = fitGhost(offsets)!;
    const g = simulateWith((t) => ghostThrow(t, ghost, rng), 60);
    expect(Math.abs(g - player)).toBeLessThan(4);
  });

  it('falls back to your average through the bot calibration', () => {
    expect(sigmaForAverage(60)).toBeCloseTo(13.3);
    const s = sigmaForAverage(52);
    expect(s).toBeLessThan(18.4);
    expect(s).toBeGreaterThan(13.3);
    const avg = simulateAverage(sigmaForAverage(52), 120, seeded(5));
    expect(Math.abs(avg - 52)).toBeLessThan(5);
    expect(nearestLevel(ghostFromAverage(76))).toBe(4);
  });
});

describe('weekly trends', () => {
  it('buckets darts by week and rates doubles and trebles', () => {
    const now = 10 * WEEK_MS;
    const at = (w: number) => now - w * WEEK_MS - 1000;
    const darts = [
      ...Array.from({ length: 10 }, (_, i) =>
        dart(
          null,
          { segment: 16, multiplier: 2 },
          { at: at(0), hit: i < 3 ? hitOf(16, 2) : hitOf(16, 1), precision: 'segment' },
        ),
      ),
      ...Array.from({ length: 9 }, (_, i) =>
        dart(null, T20, {
          at: at(1),
          hit: i < 3 ? hitOf(20, 3) : hitOf(20, 1),
          precision: 'segment',
        }),
      ),
    ];
    const w = weeklyTrends(darts, now, 4);
    expect(w[0]).toMatchObject({ ago: 0, darts: 10, doublesRate: 0.3, treblesRate: null });
    expect(w[1]!.treblesRate).toBeCloseTo(1 / 3);
    expect(w[2]!.darts).toBe(0);
  });
});
