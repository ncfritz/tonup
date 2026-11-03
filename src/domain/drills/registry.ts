import { assessment } from './assessment';
import { bobs27 } from './bobs27';
import { bullseye, checkoutsPractice, doublesLock, oneSeventy, t20 } from './aims';
import { catch40, hubbe, oneTwentyOne, pressure, randomCheckout } from './checkouts';
import { clockDrill } from './clock';
import { countUp } from './countUp';
import { halveItSprint, shanghaiDrill } from './games';
import { jdc } from './jdc';
import type { DrillDefinition, DrillId } from './types';

/** Every drill, in the order the Practice tab lists them within a skill. */
export const drills = {
  bobs27,
  countUp,
  clock: clockDrill,
  t20,
  halveIt: halveItSprint,
  shanghai: shanghaiDrill,
  bullseye,
  checkouts: checkoutsPractice,
  doublesLock,
  catch40,
  oneTwentyOne,
  hubbe,
  randomCheckout,
  oneSeventy,
  pressure,
  jdc,
  assessment,
} as const satisfies Record<DrillId, unknown>;

export function drillFor(id: string): DrillDefinition<unknown, unknown> {
  const d = (drills as Record<string, unknown>)[id];
  if (!d) throw new Error(`Unknown drill ${id}`);
  return d as DrillDefinition<unknown, unknown>;
}

export const DRILL_IDS = Object.keys(drills) as DrillId[];
export const isDrillId = (v: unknown): v is DrillId => typeof v === 'string' && v in drills;

/** Whether `a` beats `b` for this drill. */
export const beats = (better: 'higher' | 'lower', a: number, b: number) =>
  better === 'higher' ? a > b : a < b;

export type { DrillDefinition, DrillId, DrillPrompt, DrillStep, Skill } from './types';
