// Bots throw simulated darts (ADR 0007): aim at a point, add 2D Gaussian scatter in millimetres,
// and score the landing point with the same board geometry as everyone else.
import { centreOf, hitAt } from '../board';
import type { BoardType, Hit, Point, Target } from '../darts';

import { gaussianPair, type Rng } from './rng';

export interface BotLevel {
  level: number;
  /** The 3-dart average the level is tuned to in 501 double out. */
  targetAverage: number;
  /** Standard deviation of the scatter in each axis, in mm. */
  sigma: number;
}

/**
 * Levels 1–5, calibrated by simulation (`simulateAverage`, see bot.test.ts) to average about 30,
 * 45, 60, 75 and 90.
 */
export const BOT_LEVELS: readonly BotLevel[] = [
  { level: 1, targetAverage: 30, sigma: 28.5 },
  { level: 2, targetAverage: 45, sigma: 18.4 },
  { level: 3, targetAverage: 60, sigma: 13.3 },
  { level: 4, targetAverage: 75, sigma: 10.2 },
  { level: 5, targetAverage: 90, sigma: 7.7 },
];

export function botLevel(level: number): BotLevel {
  const found = BOT_LEVELS.find((l) => l.level === level);
  if (!found) throw new RangeError(`No bot level ${level}`);
  return found;
}

/** Where a dart aimed at `aim` lands with scatter `sigma`. */
export function scatter(aim: Point, sigma: number, rng: Rng): Point {
  const [dx, dy] = gaussianPair(rng);
  return { x: aim.x + dx * sigma, y: aim.y + dy * sigma };
}

/** Throws one dart at a target: the landing point and what it scored. */
export function throwAt(
  target: Target,
  sigma: number,
  rng: Rng,
  board: BoardType = 'steel',
): { point: Point; hit: Hit } {
  const point = scatter(centreOf(target, board), sigma, rng);
  return { point, hit: hitAt(point, board) };
}

/**
 * The bot's next dart in any game: aim where the game says (`targetFor`, which follows the
 * checkout route in X01) and scatter by the level. Null when the game has nothing to aim at.
 */
export function botThrow<State>(
  game: { targetFor(state: State): Target | null },
  state: State,
  level: number,
  rng: Rng,
  board: BoardType = 'steel',
): { point: Point; hit: Hit; intended: Target } | null {
  const intended = game.targetFor(state);
  if (!intended) return null;
  return { ...throwAt(intended, botLevel(level).sigma, rng, board), intended };
}
