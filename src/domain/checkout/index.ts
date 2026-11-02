// Checkout routes (docs/plan/v1-implementation.md §3 → Checkouts). Routes are worked out once
// per out rule with a cost model that matches the standard charts (fewest darts, T20 and T19
// setups, the 20, 16 and 10 doubles, a setup that still leaves a finish if the treble is missed
// into its single), then corrected by hand in OVERRIDES where a chart prefers another route.
import { BULL, hitOfTarget, type Target } from '../darts';

export type OutRule = 'double' | 'master' | 'straight';

/** At most three darts; the last one finishes. */
export type Route = Target[];

/** Highest finish for each out rule: 170 (T20 T20 Bull), 180 for master and straight out. */
export const MAX_FINISH: Record<OutRule, number> = { double: 170, master: 180, straight: 180 };

const T = (segment: number): Target => ({ segment, multiplier: 3 });
const D = (segment: number): Target => ({ segment, multiplier: 2 });
const S = (segment: number): Target => ({ segment, multiplier: 1 });

/** Every target worth aiming at. */
const ALL: Target[] = [
  ...Array.from({ length: 20 }, (_, i) => T(20 - i)),
  ...Array.from({ length: 20 }, (_, i) => D(20 - i)),
  ...Array.from({ length: 20 }, (_, i) => S(20 - i)),
  S(BULL),
  D(BULL),
];

const value = (t: Target) => hitOfTarget(t).score;

export function finishes(t: Target, out: OutRule): boolean {
  if (out === 'straight') return true;
  if (out === 'double') return t.multiplier === 2;
  return t.multiplier >= 2;
}

// How much a finishing double is wanted: D20 and D16 split down to other doubles when missed
// into the single, small and odd doubles don't, and the bull is a last resort.
const DOUBLE_COST: Record<number, number> = {
  20: 0,
  16: 0,
  18: 0.1,
  12: 0.12,
  10: 0.12,
  8: 0.12,
  14: 0.2,
  4: 0.3,
  6: 0.3,
  2: 0.4,
  [BULL]: 0.6,
};
const finishCost = (t: Target, preferred?: number) => {
  if (preferred !== undefined && t.segment === preferred && t.multiplier === 2) return -0.05;
  if (t.multiplier === 2) return DOUBLE_COST[t.segment] ?? 0.45;
  // Master and straight out: trebles and singles are fine finishes.
  return t.multiplier === 3 ? 0.15 : 0.1;
};

const TREBLE_COST: Record<number, number> = { 20: 0, 19: 0.05, 18: 0.1, 17: 0.1 };
const setupCost = (t: Target) => {
  if (t.segment === BULL) return t.multiplier === 2 ? 0.7 : 0.45;
  if (t.multiplier === 3) return TREBLE_COST[t.segment] ?? 0.2;
  if (t.multiplier === 2) return 0.5;
  return 0.1;
};

/** Each dart costs more than any preference, so the fewest darts always wins. */
const DART = 1;
/** Aiming at a treble that, missed into its single, leaves no finish with the darts left. */
const MISS_PENALTY = 0.1;

type Table = Map<string, { route: Route; cost: number } | null>;

function build(out: OutRule, preferred?: number): Table {
  const table: Table = new Map();
  const key = (r: number, n: number) => `${r}/${n}`;
  const get = (r: number, n: number) => table.get(key(r, n)) ?? null;
  for (let n = 1; n <= 3; n++) {
    for (let r = 1; r <= MAX_FINISH[out]; r++) {
      let best: { route: Route; cost: number } | null = n > 1 ? get(r, n - 1) : null;
      for (const t of ALL) {
        const v = value(t);
        if (v === r && finishes(t, out)) {
          const cost = DART + finishCost(t, preferred);
          if (!best || cost < best.cost - 1e-9) best = { route: [t], cost };
        } else if (n > 1 && v < r) {
          const rest = get(r - v, n - 1);
          if (!rest) continue;
          let cost = DART + setupCost(t) + rest.cost;
          if (t.multiplier === 3 && !get(r - t.segment, n - 1)) cost += MISS_PENALTY;
          if (!best || cost < best.cost - 1e-9) best = { route: [t, ...rest.route], cost };
        }
      }
      table.set(key(r, n), best);
    }
  }
  return table;
}

/**
 * Hand corrections to the generated routes, by out rule and remaining score, where the standard
 * charts prefer another route. Used whenever the darts left allow the route.
 */
const OVERRIDES: Partial<Record<OutRule, Record<number, Route>>> = {
  double: {
    61: [T(15), D(8)],
    63: [T(13), D(12)],
    64: [T(16), D(8)],
    68: [T(20), D(4)],
    72: [T(16), D(12)],
  },
};

const tables = new Map<string, Table>();

/**
 * The route to finish `remaining` with `dartsLeft` darts, or null when there's none (a bogey
 * number, too high, or 1 on a double out). `preferredDouble` breaks ties toward a favourite.
 */
export function checkoutRoute(
  remaining: number,
  dartsLeft: number,
  out: OutRule = 'double',
  preferredDouble?: number,
): Route | null {
  if (dartsLeft < 1 || remaining < 1 || remaining > MAX_FINISH[out]) return null;
  const n = Math.min(3, dartsLeft);
  const override = OVERRIDES[out]?.[remaining];
  if (override && override.length <= n) return override;
  const id = `${out}/${preferredDouble ?? ''}`;
  let table = tables.get(id);
  if (!table) {
    table = build(out, preferredDouble);
    tables.set(id, table);
  }
  return table.get(`${remaining}/${n}`)?.route ?? null;
}

/** Scores 2–170 with no three-dart double-out finish. */
export const BOGEY_NUMBERS = [159, 162, 163, 165, 166, 168, 169] as const;

/**
 * Where to aim the next dart when there's no finish: treble 20 while it can't bust, otherwise
 * a single that leaves the best double for the darts after it.
 */
export function setupTarget(
  remaining: number,
  out: OutRule = 'double',
  preferredDouble?: number,
): Target {
  if (remaining - 60 >= 2 || out === 'straight') return T(20);
  let best: { t: Target; cost: number } | null = null;
  for (const t of ALL) {
    if (t.multiplier !== 1 || t.segment === BULL) continue;
    const left = remaining - value(t);
    const route = checkoutRoute(left, 1, out, preferredDouble);
    if (!route) continue;
    const cost = finishCost(route[0]!, preferredDouble);
    if (!best || cost < best.cost) best = { t, cost };
  }
  return best?.t ?? S(Math.max(1, Math.min(20, remaining - 2)));
}
