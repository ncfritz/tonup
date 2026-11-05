// Days and ranges for the calendar and the time-range control (docs/design/stats.md → Time
// range). Days are local calendar days, so a late session counts for the evening it was in.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_DAYS = 7;

/** The time-range control: a preset number of days, or chosen dates. */
export type StatsRange =
  { kind: 'days'; days: 30 | 60 | 90 } | { kind: 'custom'; from: number; to: number };

export const RANGE_PRESETS = [30, 60, 90] as const;
export const DEFAULT_RANGE: StatsRange = { kind: 'days', days: 30 };

/** Midnight at the start of the local day holding `t`. */
export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** `n` local days after the day holding `t` (handles daylight-saving days). */
export function addDays(t: number, n: number): number {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** The first and last moment a range covers, given today. */
export function rangeBounds(r: StatsRange, now: number): { from: number; to: number } {
  if (r.kind === 'custom') {
    const from = startOfDay(Math.min(r.from, r.to));
    const to = addDays(Math.max(r.from, r.to), 1) - 1;
    return { from, to };
  }
  return { from: addDays(now, -(r.days - 1)), to: addDays(now, 1) - 1 };
}

/** How many days a range covers. */
export function rangeDays(r: StatsRange, now: number): number {
  const { from, to } = rangeBounds(r, now);
  return Math.round((startOfDay(to) - from) / DAY_MS) + 1;
}

export const inRange = (t: number, b: { from: number; to: number }) => t >= b.from && t <= b.to;

/**
 * One entry per day from `from` to `to`, oldest first, with what happened on it: `kinds` holds
 * the kinds of session that day ("game", "drill").
 */
export function days<K extends string>(
  events: readonly { at: number; kind: K }[],
  bounds: { from: number; to: number },
): { day: number; kinds: K[] }[] {
  const out: { day: number; kinds: K[] }[] = [];
  const index = new Map<number, number>();
  for (let d = startOfDay(bounds.from); d <= bounds.to; d = addDays(d, 1)) {
    index.set(d, out.length);
    out.push({ day: d, kinds: [] });
  }
  for (const e of events) {
    const i = index.get(startOfDay(e.at));
    if (i === undefined) continue;
    const kinds = out[i]!.kinds;
    if (!kinds.includes(e.kind)) kinds.push(e.kind);
  }
  return out;
}

/** The current run of active days ending today (or yesterday), and the longest run. */
export function streaks(active: readonly boolean[]): { current: number; longest: number } {
  let longest = 0;
  let run = 0;
  for (const a of active) {
    run = a ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Today not played yet doesn't break the streak.
  let current = 0;
  let i = active.length - 1;
  if (i >= 0 && !active[i]) i--;
  while (i >= 0 && active[i]) {
    current++;
    i--;
  }
  return { current, longest };
}

/** The longest run's first and last day, for "12 to 15 October". */
export function longestRun(
  list: readonly { day: number; active: boolean }[],
): { from: number; to: number; length: number } | null {
  let best: { from: number; to: number; length: number } | null = null;
  let start = -1;
  list.forEach((d, i) => {
    if (d.active && start < 0) start = i;
    const ends = d.active && (i === list.length - 1 || !list[i + 1]!.active);
    if (ends) {
      const length = i - start + 1;
      if (!best || length > best.length) best = { from: list[start]!.day, to: d.day, length };
      start = -1;
    }
  });
  return best;
}
