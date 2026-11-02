import { bobs27 } from './bobs27';
import { clockDrill } from './clock';
import { countUp } from './countUp';
import type { DrillDefinition, DrillId } from './types';

/** The drills in the app; the rest of the library is Pro (M12). */
export const drills = { bobs27, countUp, clock: clockDrill } as const;

export function drillFor(id: string): DrillDefinition<unknown, unknown> {
  const d = (drills as Record<string, unknown>)[id];
  if (!d) throw new Error(`Unknown drill ${id}`);
  return d as DrillDefinition<unknown, unknown>;
}

export const DRILL_IDS = Object.keys(drills) as DrillId[];

/** Whether `a` beats `b` for this drill. */
export const beats = (better: 'higher' | 'lower', a: number, b: number) =>
  better === 'higher' ? a > b : a < b;

export type { DrillDefinition, DrillId, DrillStep, Skill } from './types';
