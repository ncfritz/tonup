// Today's plan on the Practice tab (Pro): your last assessment, the doubles you've been missing,
// and which of today's drills you've done (src/domain/drills/plan.ts).
import {
  assessmentLevels,
  doubleRates,
  planFor,
  type AssessedSkill,
  type AssessmentState,
  type DrillId,
  type Plan,
} from '@/domain/drills';
import { dartsOf, finishedOfType, recentSessions } from '@/services/db/sessionsRepo';

import { YOU_ID } from '../game/lineup';
import { loadGame } from '../game/session';

/** Sessions whose darts feed the doubles in the plan. */
const RECENT = 30;

export interface TodayPlan {
  plan: Plan;
  levels: Record<AssessedSkill, number> | null;
  /** Plan drills finished since midnight. */
  done: DrillId[];
}

const startOfDay = (now: number) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function todayPlan(now = Date.now()): TodayPlan {
  const last = finishedOfType('drill', 'assessment', 1)[0];
  const levels = last ? assessmentLevels(loadGame(last.id).state as AssessmentState) : null;
  const rates = doubleRates(dartsOf(YOU_ID, recentSessions(RECENT)));
  const plan = planFor({ levels, assessedAt: last?.endedAt ?? null, now, rates });
  const today = startOfDay(now);
  const ids = [plan.warmUp, ...plan.main].filter((x): x is DrillId => x !== null);
  const done = ids.filter((id) => (finishedOfType('drill', id, 1)[0]?.endedAt ?? 0) >= today);
  return { plan, levels, done };
}
