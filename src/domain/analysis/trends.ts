// Weekly trends (docs/features.md → Pro analysis): doubles and trebles hit rates and grouping,
// week by week, from every dart you've aimed.
import type { DartEvent } from '../darts';

import { aimOffsets, grouping } from './grouping';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface Week {
  /** 0 is the last seven days, 1 the week before… */
  ago: number;
  darts: number;
  doublesRate: number | null;
  treblesRate: number | null;
  /** Grouping (σ in mm), from tapped darts. */
  sigma: number | null;
}

/** Fewest darts at a kind of target for its rate to show in a week. */
export const WEEK_MIN = 9;

export function weeklyTrends(darts: readonly DartEvent[], now: number, weeks = 12): Week[] {
  const buckets = Array.from({ length: weeks }, () => [] as DartEvent[]);
  for (const d of darts) {
    if (d.source === 'bot') continue;
    const ago = Math.floor((now - d.at) / WEEK_MS);
    if (ago >= 0 && ago < weeks) buckets[ago]!.push(d);
  }
  return buckets.map((ds, ago) => {
    const at = (m: 2 | 3) =>
      ds.filter((d) => d.intended?.multiplier === m && d.intended.segment !== 25);
    const rate = (m: 2 | 3) => {
      const a = at(m);
      if (a.length < WEEK_MIN) return null;
      const hits = a.filter((d) => d.hit.segment === d.intended!.segment && d.hit.multiplier === m);
      return hits.length / a.length;
    };
    const g = grouping(aimOffsets(ds));
    return {
      ago,
      darts: ds.length,
      doublesRate: rate(2),
      treblesRate: rate(3),
      sigma: g && g.n >= WEEK_MIN ? g.sigma : null,
    };
  });
}
