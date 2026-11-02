// Board heatmap bins (docs/plan/v1-implementation.md §3 → Stats): darts counted per region of
// the board (each segment's four rings and the two bulls), so keypad darts count too.
import type { Hit } from '../darts';

/** "20:treble", "25:innerBull", "miss". */
export type RegionKey = string;

export const regionOf = (h: Hit): RegionKey =>
  h.ring === 'miss' ? 'miss' : `${h.segment}:${h.ring}`;

export interface Heat {
  region: RegionKey;
  count: number;
  /** count ÷ the busiest region's count, 0–1. */
  intensity: number;
}

/** Counts per region, busiest first; misses are counted separately. */
export function heatmap(hits: readonly Hit[]): { regions: Heat[]; misses: number; total: number } {
  const counts = new Map<RegionKey, number>();
  let misses = 0;
  for (const h of hits) {
    if (h.ring === 'miss') {
      misses++;
      continue;
    }
    const k = regionOf(h);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const max = Math.max(1, ...counts.values());
  const regions = [...counts.entries()]
    .map(([region, count]) => ({ region, count, intensity: count / max }))
    .sort((a, b) => b.count - a.count);
  return { regions, misses, total: hits.length };
}

/** Parses a region key back into segment and ring. */
export function parseRegion(k: RegionKey): { segment: number; ring: Hit['ring'] } | null {
  if (k === 'miss') return null;
  const [seg, ring] = k.split(':');
  return { segment: Number(seg), ring: ring as Hit['ring'] };
}
