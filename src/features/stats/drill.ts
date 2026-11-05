// A drill's page (docs/design/stats.md → Per drill): its scores over the chosen range, the days
// you did it, and the view that suits the drill.
import {
  assessmentLevels,
  BOBS27_TARGETS,
  drillFor,
  type AssessedSkill,
  type AssessmentState,
  type DrillId,
} from '@/domain/drills';
import type { CheckoutState } from '@/domain/drills/checkouts';
import {
  days,
  doubleLadder,
  finishBands,
  longestRun,
  missedFinishes,
  missSplit,
  rangeBounds,
  targetRates,
  trend,
  visitBands,
  type FinishAttempt,
  type FinishBand,
  type MissSide,
  type StatsRange,
  type TargetRate,
  type Trend,
  type VisitBand,
} from '@/domain/stats';
import { finishedBetween } from '@/services/db/sessionsRepo';

import { YOU_ID } from '../game/lineup';
import { loadGame, type LoadedGame } from '../game/session';

/** The view each drill adds under its trend. */
export type DrillView = 'grid' | 'ladder' | 'visits' | 'wheel' | 'finish' | 'skills';

export const DRILL_VIEWS: Record<DrillId, DrillView[]> = {
  bobs27: ['grid', 'ladder'],
  countUp: ['visits'],
  clock: ['wheel'],
  t20: ['visits'],
  halveIt: ['grid'],
  shanghai: ['wheel'],
  bullseye: [],
  checkouts: ['ladder'],
  doublesLock: ['ladder'],
  catch40: ['finish'],
  oneTwentyOne: ['finish'],
  hubbe: ['finish'],
  randomCheckout: ['finish'],
  oneSeventy: [],
  pressure: ['finish'],
  jdc: ['grid'],
  assessment: ['skills'],
};

/** Catch 40 covers 61–100, so it gets narrower bands. */
const CATCH40_BANDS = [
  [61, 70],
  [71, 80],
  [81, 90],
  [91, 100],
] as const;

export interface DrillPage {
  id: DrillId;
  better: 'higher' | 'lower';
  /** Oldest first. */
  scores: { sessionId: string; at: number; score: number }[];
  trend: Trend;
  calendar: { day: number; kinds: string[] }[];
  daysActive: number;
  longest: { from: number; to: number; length: number } | null;
  /** The last eight sessions, newest first: a level 0–1 per step, null for not reached. */
  grid?: { columns: string[]; rows: { at: number; cells: (number | null)[] }[] };
  ladder?: TargetRate[];
  visits?: Record<VisitBand, number>;
  miss?: { counts: Record<MissSide, number>; total: number };
  wheel?: { kind: 'darts' | 'rate'; rates: TargetRate[] };
  finish?: { bands: FinishBand[]; missed: ReturnType<typeof missedFinishes> };
  skills?: { at: number; levels: Record<AssessedSkill, number> }[];
}

/** A step's level in the session grid. */
function stepLevel(id: DrillId, i: number, step: { state: string; value?: number }): number | null {
  if (step.state === 'todo' || step.state === 'current') return null;
  if (step.state === 'missed') return 0;
  if (id === 'bobs27') {
    // A round scores hits × the double's value; three hits is full.
    const n = BOBS27_TARGETS[i] ?? 0;
    const each = n === 25 ? 50 : n * 2;
    return step.value && each ? Math.min(1, step.value / (each * 3)) : 0;
  }
  return 1;
}

export function loadDrillPage(id: DrillId, range: StatsRange, now = Date.now()): DrillPage {
  const def = drillFor(id);
  const bounds = rangeBounds(range, now);
  const sessions = finishedBetween(bounds.from, bounds.to, 'drill').filter((s) => s.typeId === id);
  const games: LoadedGame[] = sessions.flatMap((s) => {
    try {
      return [loadGame(s.id)];
    } catch {
      return [];
    }
  });
  const scores = sessions.flatMap((s) => {
    const score = (s.result as { score?: Record<string, number> } | null)?.score?.[YOU_ID];
    return typeof score === 'number' ? [{ sessionId: s.id, at: s.endedAt, score }] : [];
  });
  const calendar = days(
    sessions.map((s) => ({ at: s.endedAt, kind: 'drill' })),
    bounds,
  );
  const page: DrillPage = {
    id,
    better: def.better,
    scores,
    trend: trend(
      scores.map((s) => s.score),
      def.better,
    ),
    calendar,
    daysActive: calendar.filter((d) => d.kinds.length).length,
    longest: longestRun(calendar.map((d) => ({ day: d.day, active: d.kinds.length > 0 }))),
  };
  const mine = games.flatMap((g) => g.darts.filter((d) => d.playerId === YOU_ID));

  for (const view of DRILL_VIEWS[id]) {
    if (view === 'grid') {
      const recent = [...games].reverse().slice(0, 8);
      const steps = recent.map((g) => def.steps(g.state));
      page.grid = {
        columns: (steps[0] ?? def.steps(def.init(def.defaults, [{ id: YOU_ID, name: '' }]))).map(
          (s) => s.label,
        ),
        rows: recent.map((g, k) => ({
          at: g.session.endedAt ?? g.session.startedAt,
          cells: steps[k]!.map((s, i) => stepLevel(id, i, s)),
        })),
      };
    } else if (view === 'ladder') {
      page.ladder = doubleLadder(mine);
    } else if (view === 'visits') {
      const totals = games.flatMap((g) =>
        g.def
          .visits(g.state)
          .filter((v) => v.done)
          .map((v) => (v.bust ? 0 : v.total)),
      );
      page.visits = visitBands(totals);
      page.miss = missSplit(mine);
    } else if (view === 'wheel') {
      page.wheel = { kind: id === 'clock' ? 'darts' : 'rate', rates: targetRates(mine) };
    } else if (view === 'finish') {
      const attempts: FinishAttempt[] = games.flatMap(
        (g) => (g.state as CheckoutState).attempts ?? [],
      );
      page.finish = {
        bands: finishBands(attempts, id === 'catch40' ? CATCH40_BANDS : undefined),
        missed: missedFinishes(attempts),
      };
    } else if (view === 'skills') {
      page.skills = games.map((g) => ({
        at: g.session.endedAt ?? g.session.startedAt,
        levels: assessmentLevels(g.state as AssessmentState),
      }));
    }
  }
  return page;
}
