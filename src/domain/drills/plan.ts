// The adaptive plan (docs/research/training.md → Experiences): today's 20–30 minute session,
// picked from the weakest area of your last skill assessment. A warm-up for accuracy, then two
// drills for the weakest skill, rotating day by day; with doubles weakest, the plan names the
// doubles you've been missing most.
import type { DartEvent } from '../darts';

import type { AssessedSkill } from './assessment';
import type { DrillId } from './types';

/** A month: after this the plan asks for the assessment again. */
export const ASSESSMENT_EVERY_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const WARM_UPS: DrillId[] = ['clock', 'bullseye', 'shanghai'];
/** Drills for each skill, easier first; levels 1–2 stay among the first three. */
export const POOLS: Record<AssessedSkill, DrillId[]> = {
  scoring: ['countUp', 'halveIt', 't20'],
  doubles: ['bobs27', 'checkouts', 'doublesLock'],
  checkouts: ['catch40', 'randomCheckout', 'pressure', 'oneTwentyOne', 'hubbe', 'oneSeventy'],
};
/** Which area comes first when two are level: doubles win most legs. */
const ORDER: AssessedSkill[] = ['doubles', 'checkouts', 'scoring'];

/** About how long each drill takes, for the plan's minutes. */
export const MINUTES: Partial<Record<DrillId, number>> = {
  bobs27: 15,
  countUp: 5,
  clock: 8,
  t20: 10,
  halveIt: 4,
  shanghai: 10,
  bullseye: 5,
  checkouts: 6,
  doublesLock: 12,
  catch40: 20,
  oneTwentyOne: 10,
  hubbe: 12,
  randomCheckout: 10,
  oneSeventy: 8,
  pressure: 6,
  jdc: 15,
  assessment: 15,
};

export interface DoubleRate {
  segment: number;
  attempts: number;
  hits: number;
}

/** Hit rates on each double you aimed at, from darts that say what they were aimed at. */
export function doubleRates(darts: readonly DartEvent[]): DoubleRate[] {
  const by = new Map<number, DoubleRate>();
  for (const d of darts) {
    if (d.intended?.multiplier !== 2) continue;
    const segment = d.intended.segment;
    const r = by.get(segment) ?? { segment, attempts: 0, hits: 0 };
    r.attempts += 1;
    if (d.hit.segment === segment && d.hit.isDouble) r.hits += 1;
    by.set(segment, r);
  }
  return [...by.values()];
}

/** The doubles you hit least, with enough darts at them to say. */
export function worstDoubles(rates: readonly DoubleRate[], min = 6, count = 2): DoubleRate[] {
  return rates
    .filter((r) => r.attempts >= min)
    .sort(
      (a, b) =>
        a.hits / a.attempts - b.hits / b.attempts ||
        b.attempts - a.attempts ||
        b.segment - a.segment,
    )
    .slice(0, count);
}

export interface PlanInput {
  /** Levels from your last assessment, or null if you haven't taken one. */
  levels: Record<AssessedSkill, number> | null;
  assessedAt: number | null;
  now: number;
  rates: readonly DoubleRate[];
}

export interface Plan {
  /** The assessment is due: never taken, or a month old. */
  due: 'first' | 'monthly' | null;
  focus: AssessedSkill | null;
  level: number | null;
  warmUp: DrillId | null;
  main: DrillId[];
  doubles: DoubleRate[];
  minutes: number;
}

export function weakest(levels: Record<AssessedSkill, number>): AssessedSkill {
  return ORDER.reduce((best, s) => (levels[s] < levels[best] ? s : best), ORDER[0]!);
}

export function planFor({ levels, assessedAt, now, rates }: PlanInput): Plan {
  if (!levels || assessedAt === null) {
    return {
      due: 'first',
      focus: null,
      level: null,
      warmUp: null,
      main: [],
      doubles: [],
      minutes: MINUTES.assessment!,
    };
  }
  const focus = weakest(levels);
  const level = levels[focus];
  const day = Math.floor(now / DAY_MS);
  const pool = level <= 2 ? POOLS[focus].slice(0, 3) : POOLS[focus];
  const first = day % pool.length;
  const main = [pool[first]!, pool[(first + 1) % pool.length]!];
  const warmUp = WARM_UPS[day % WARM_UPS.length]!;
  const minutes = [warmUp, ...main].reduce((n, id) => n + (MINUTES[id] ?? 10), 0);
  return {
    due: now - assessedAt > ASSESSMENT_EVERY_MS ? 'monthly' : null,
    focus,
    level,
    warmUp,
    main,
    doubles: focus === 'doubles' ? worstDoubles(rates) : [],
    minutes,
  };
}
