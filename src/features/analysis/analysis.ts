// Pro analysis (docs/design/screens.md → Analysis): your aimed darts pooled across games and
// drills, weekly trends, the aim map and the ghost bot (src/domain/analysis).
import {
  AIM_MAP_MIN,
  aimMap,
  aimOffsets,
  fitGhost,
  fitSigma,
  ghostFromAverage,
  ghostThrow,
  inGroup,
  WEEK_MS,
  weeklyTrends,
  type AimMap,
  type GhostParams,
  type Offset,
  type Week,
} from '@/domain/analysis';
import { seeded, simulateWith } from '@/domain/bot';
import { dartsOf, finishedOfType, recentSessions } from '@/services/db/sessionsRepo';

import { YOU_ID } from '../game/lineup';
import { loadGame, sessionStats } from '../game/session';

/** Sessions the analysis looks back over. */
const SESSIONS = 300;
export const TREND_WEEKS = 12;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface Analysis {
  offsets: Offset[];
  weeks: Week[];
  /** Your X01 average week by week (null where you played none), oldest last like `weeks`. */
  averages: (number | null)[];
  ghost: Ghost | null;
  now: number;
}

export interface Ghost {
  params: GhostParams;
  /** Fitted from tapped darts, or from your average when there weren't enough. */
  source: 'darts' | 'average';
  /** Your X01 average over the month, if you played any. */
  average: number | null;
  /** What the ghost averages in simulated 501 legs. */
  ghostAverage: number;
}

function x01Averages(
  now: number,
  weeks: number,
): { weekly: (number | null)[]; month: number | null } {
  const sums = Array.from({ length: weeks }, () => ({ total: 0, n: 0 }));
  const month = { total: 0, n: 0 };
  for (const s of finishedOfType('game', 'x01', 200)) {
    const ago = Math.floor((now - s.endedAt) / WEEK_MS);
    if (ago >= weeks) break;
    const avg = sessionStats(loadGame(s.id), YOU_ID).find((l) => l.key === 'average')?.value;
    if (typeof avg !== 'number' || avg <= 0) continue;
    sums[ago]!.total += avg;
    sums[ago]!.n += 1;
    if (now - s.endedAt <= MONTH_MS) {
      month.total += avg;
      month.n += 1;
    }
  }
  return {
    weekly: sums.map((s) => (s.n ? s.total / s.n : null)),
    month: month.n ? month.total / month.n : null,
  };
}

export function loadAnalysis(now = Date.now()): Analysis {
  const darts = dartsOf(YOU_ID, recentSessions(SESSIONS));
  const offsets = aimOffsets(darts);
  const weeks = weeklyTrends(darts, now, TREND_WEEKS);
  const avgs = x01Averages(now, TREND_WEEKS);
  return { offsets, weeks, averages: avgs.weekly, ghost: ghostFor(offsets, avgs.month, now), now };
}

/** "You from last month": fitted from the month's tapped darts, or your month's average. */
export function ghostFor(offsets: Offset[], average: number | null, now: number): Ghost | null {
  const month = offsets.filter((o) => now - o.at <= MONTH_MS);
  const fitted = fitGhost(month);
  const params = fitted ?? (average !== null ? ghostFromAverage(average) : null);
  if (!params) return null;
  const rng = seeded(1);
  const ghostAverage = simulateWith((t) => ghostThrow(t, params, rng), 40);
  return { params, source: fitted ? 'darts' : 'average', average, ghostAverage };
}

/** Darts the aim map is fitted from: aimed at the bull if there are enough, otherwise all. */
export function aimMapOffsets(offsets: Offset[]): Offset[] | null {
  const bull = offsets.filter((o) => inGroup(o.target, 'bull'));
  if (bull.length >= AIM_MAP_MIN) return bull;
  return offsets.length >= AIM_MAP_MIN ? offsets : null;
}

const maps = new Map<number, AimMap>();

/** The aim map for your scatter, worked out once per millimetre of σ (it takes a moment). */
export function aimMapFor(offsets: Offset[]): AimMap | null {
  const from = aimMapOffsets(offsets);
  if (!from) return null;
  const sigma = Math.max(1, Math.round(fitSigma(from)));
  let map = maps.get(sigma);
  if (!map) {
    map = aimMap(sigma);
    maps.set(sigma, map);
  }
  return map;
}
