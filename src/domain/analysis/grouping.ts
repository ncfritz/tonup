// Aim-relative analysis (docs/features.md → Pro analysis): every dart with a landing point and a
// known aim becomes an offset from the middle of what it was aimed at, pooled across games. From
// the offsets: drift (the average miss), grouping (spread around it) and a heatmap centred on the
// aim. Board space is millimetres, x to the right and y up (src/domain/board).
import { centreOf } from '../board';
import { BULL, type DartEvent, type Target } from '../darts';

export interface Offset {
  dx: number;
  dy: number;
  target: Target;
  at: number;
}

/**
 * Offsets from your own darts: exact landing points (taps now, the camera later) with an aim.
 * Keypad darts are drawn at the segment centre, so they say nothing about where they landed.
 */
export function aimOffsets(darts: readonly DartEvent[]): Offset[] {
  const out: Offset[] = [];
  for (const d of darts) {
    if (d.source === 'bot' || d.precision !== 'exact' || !d.point || !d.intended) continue;
    const c = centreOf(d.intended);
    out.push({ dx: d.point.x - c.x, dy: d.point.y - c.y, target: d.intended, at: d.at });
  }
  return out;
}

export type TargetGroup = 'all' | 't20' | 'trebles' | 'doubles' | 'bull';
export const TARGET_GROUPS: TargetGroup[] = ['all', 't20', 'trebles', 'doubles', 'bull'];

export function inGroup(t: Target, g: TargetGroup): boolean {
  switch (g) {
    case 'all':
      return true;
    case 't20':
      return t.segment === 20 && t.multiplier === 3;
    case 'trebles':
      return t.multiplier === 3;
    case 'doubles':
      return t.multiplier === 2 && t.segment !== BULL;
    case 'bull':
      return t.segment === BULL;
  }
}

export type Direction =
  'up' | 'upRight' | 'right' | 'downRight' | 'down' | 'downLeft' | 'left' | 'upLeft';
const DIRECTIONS: Direction[] = [
  'up',
  'upRight',
  'right',
  'downRight',
  'down',
  'downLeft',
  'left',
  'upLeft',
];

export interface Grouping {
  n: number;
  /** The average offset: where your darts land relative to the aim, on average. */
  mean: { x: number; y: number };
  /** Standard deviations around the mean, and their correlation. */
  sx: number;
  sy: number;
  rho: number;
  /** One spread figure: the root mean square of sx and sy. */
  sigma: number;
  /** Half your darts land within this distance of your average landing point. */
  r50: number;
  /** The drift's size and direction; 'none' when it's small next to the spread. */
  drift: { mm: number; direction: Direction | 'none' };
}

/** Below this the drift is noise: a few mm, or small next to your grouping. */
export const DRIFT_MIN_MM = 3;
export const DRIFT_MIN_SIGMAS = 0.25;

export function compass(x: number, y: number): Direction {
  const deg = ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  return DIRECTIONS[Math.round(deg / 45) % 8]!;
}

export function grouping(offsets: readonly Offset[]): Grouping | null {
  const n = offsets.length;
  if (n < 2) return null;
  const mx = offsets.reduce((s, o) => s + o.dx, 0) / n;
  const my = offsets.reduce((s, o) => s + o.dy, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const o of offsets) {
    sxx += (o.dx - mx) ** 2;
    syy += (o.dy - my) ** 2;
    sxy += (o.dx - mx) * (o.dy - my);
  }
  // Sample standard deviations (n − 1).
  const sx = Math.sqrt(sxx / (n - 1));
  const sy = Math.sqrt(syy / (n - 1));
  const rho = sx && sy ? sxy / (n - 1) / (sx * sy) : 0;
  const sigma = Math.sqrt((sx * sx + sy * sy) / 2);
  const r50 = median(offsets.map((o) => Math.hypot(o.dx - mx, o.dy - my)));
  const mm = Math.hypot(mx, my);
  const real = mm >= DRIFT_MIN_MM && mm >= DRIFT_MIN_SIGMAS * sigma;
  return {
    n,
    mean: { x: mx, y: my },
    sx,
    sy,
    rho,
    sigma,
    r50,
    drift: { mm, direction: real ? compass(mx, my) : 'none' },
  };
}

export function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

export interface OffsetGrid {
  /** Cell size in mm; the grid is centred on the aim. */
  cell: number;
  /** Cells each side of the centre cell. */
  half: number;
  /** counts[row][col], row 0 at the top (most positive y). */
  counts: number[][];
  /** Darts outside the grid. */
  outside: number;
  max: number;
}

/** Offsets binned on a square grid around the aim, for the aim-relative heatmap. */
export function offsetGrid(offsets: readonly Offset[], cell = 8, half = 6): OffsetGrid {
  const size = half * 2 + 1;
  const counts = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
  let outside = 0;
  for (const o of offsets) {
    const col = Math.round(o.dx / cell) + half;
    const row = half - Math.round(o.dy / cell);
    if (col < 0 || col >= size || row < 0 || row >= size) outside += 1;
    else counts[row]![col]! += 1;
  }
  const max = Math.max(0, ...counts.flat());
  return { cell, half, counts, outside, max };
}
