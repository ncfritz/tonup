// The ghost bot (docs/features.md → "You from last month"): a bot that throws like you did. Its
// scatter is fitted from your aim-relative offsets (drift, spread on each axis and their
// correlation), or, without enough tapped darts, from your 3-dart average using the bot levels'
// calibration. Ghost darts are recorded like any bot's (ADR 0006, 0007).
import { centreOf, hitAt } from '../board';
import { BOT_LEVELS } from '../bot/bot';
import { gaussianPair, type Rng } from '../bot/rng';
import type { BoardType, Hit, Point, Target } from '../darts';

import { grouping, type Offset } from './grouping';

export interface GhostParams {
  /** Drift in mm. */
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rho: number;
}

/** Fewest tapped darts a ghost is fitted from; below this it uses your average. */
export const GHOST_MIN_DARTS = 60;

export function fitGhost(offsets: readonly Offset[]): GhostParams | null {
  if (offsets.length < GHOST_MIN_DARTS) return null;
  const g = grouping(offsets)!;
  return { dx: g.mean.x, dy: g.mean.y, sx: g.sx, sy: g.sy, rho: g.rho };
}

/**
 * The circular scatter that averages `average` in 501, interpolated between the bot levels
 * (each level is calibrated by simulation, src/domain/bot/bot.ts). Beyond the levels it
 * extrapolates along the nearest pair.
 */
export function sigmaForAverage(average: number): number {
  const lv = [...BOT_LEVELS].sort((a, b) => a.targetAverage - b.targetAverage);
  let i = lv.findIndex((l) => l.targetAverage >= average);
  if (i === -1) i = lv.length - 1;
  if (i === 0) i = 1;
  const a = lv[i - 1]!;
  const b = lv[i]!;
  // Interpolate log σ against the average.
  const t = (average - a.targetAverage) / (b.targetAverage - a.targetAverage);
  const s = Math.exp(Math.log(a.sigma) + t * (Math.log(b.sigma) - Math.log(a.sigma)));
  return Math.min(60, Math.max(3, s));
}

export const ghostFromAverage = (average: number): GhostParams => {
  const s = sigmaForAverage(average);
  return { dx: 0, dy: 0, sx: s, sy: s, rho: 0 };
};

/** Where a ghost dart aimed at `target` lands. */
export function ghostThrow(
  target: Target,
  p: GhostParams,
  rng: Rng,
  board: BoardType = 'steel',
): { point: Point; hit: Hit } {
  const c = centreOf(target, board);
  const [z1, z2] = gaussianPair(rng);
  const rho = Math.max(-0.95, Math.min(0.95, p.rho));
  const x = c.x + p.dx + p.sx * z1;
  const y = c.y + p.dy + p.sy * (rho * z1 + Math.sqrt(1 - rho * rho) * z2);
  const point = { x, y };
  return { point, hit: hitAt(point, board) };
}

/** The bot level nearest a ghost, so it counts as a bot everywhere a level is needed. */
export function nearestLevel(p: GhostParams): number {
  const s = Math.sqrt((p.sx * p.sx + p.sy * p.sy) / 2);
  return BOT_LEVELS.reduce((best, l) =>
    Math.abs(Math.log(l.sigma / s)) < Math.abs(Math.log(best.sigma / s)) ? l : best,
  ).level;
}

/** A ghost's player id carries its fit, so a stored game can replay its throws later. */
const PREFIX = 'ghost:';
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function ghostId(p: GhostParams, label: string): string {
  return `${PREFIX}${label}:${r1(p.dx)},${r1(p.dy)},${r1(p.sx)},${r1(p.sy)},${r2(p.rho)}`;
}

export function parseGhost(id: string): GhostParams | null {
  if (!id.startsWith(PREFIX)) return null;
  const nums = id
    .slice(id.lastIndexOf(':') + 1)
    .split(',')
    .map(Number);
  if (nums.length !== 5 || nums.some((n) => !Number.isFinite(n))) return null;
  const [dx, dy, sx, sy, rho] = nums as [number, number, number, number, number];
  if (sx <= 0 || sy <= 0) return null;
  return { dx, dy, sx, sy, rho };
}
