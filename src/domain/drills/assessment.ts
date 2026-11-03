// The skill assessment (docs/research/training.md → Experiences): a fifteen-minute test that
// sets a level from 1 to 5 for scoring, doubles and checkouts. The parts and targets are fixed,
// so this month's result compares with last month's.
//   Scoring: ten visits at T20, levelled by the three-dart average.
//   Doubles: three darts at each of eight doubles, levelled by the hit rate.
//   Checkouts: six finishes with one visit each, levelled by how many you take.
import { checkoutRoute, setupTarget } from '../checkout';
import type { DartEvent, PlayerRef, Target } from '../darts';
import type { GameVisit, StatLine } from '../games/types';
import { addDart, checkPlayer, endVisit } from '../games/visits';

import { onePlayer, soloResult, soloView } from './kit';
import type { DrillDefinition, DrillPrompt, DrillStep } from './types';

export type AssessedSkill = 'scoring' | 'doubles' | 'checkouts';
export const ASSESSED: AssessedSkill[] = ['scoring', 'doubles', 'checkouts'];

export const SCORING_VISITS = 10;
export const ASSESS_DOUBLES = [20, 16, 10, 8, 18, 12, 4, 2];
export const ASSESS_FINISHES = [32, 50, 61, 76, 87, 100];

type Step = { part: 'scoring' } | { part: 'doubles'; n: number } | { part: 'checkouts'; n: number };
const STEPS: Step[] = [
  ...Array.from({ length: SCORING_VISITS }, () => ({ part: 'scoring' as const })),
  ...ASSESS_DOUBLES.map((n) => ({ part: 'doubles' as const, n })),
  ...ASSESS_FINISHES.map((n) => ({ part: 'checkouts' as const, n })),
];

/** Upper bounds for levels 1–4; anything above the last is level 5. */
export const LEVELS: Record<AssessedSkill, number[]> = {
  /** Three-dart average. */
  scoring: [30, 42, 55, 70],
  /** Share of darts on the double. */
  doubles: [0.08, 0.16, 0.25, 0.35],
  /** Finishes out of six. */
  checkouts: [0.5, 1.5, 2.5, 4.5],
};

export const levelFor = (skill: AssessedSkill, value: number) =>
  LEVELS[skill].filter((bound) => value >= bound).length + 1;

export interface AssessmentState {
  player: PlayerRef;
  visits: GameVisit[];
  step: number;
  /** Per finished step: points (scoring), hits (doubles), 1 or 0 (checkouts). */
  results: number[];
  /** What's left in a checkout step. */
  remaining: number;
  over: boolean;
}

function applyDart(s: AssessmentState, dart: DartEvent): AssessmentState {
  if (s.over) throw new Error('The assessment is over');
  checkPlayer(s.player.id, dart);
  const step = STEPS[s.step]!;
  let visits: GameVisit[];
  let result: number | null = null;
  let remaining = s.remaining;
  if (step.part === 'scoring') {
    visits = addDart(s.visits, 0, dart, dart.hit.score);
    const v = visits[visits.length - 1]!;
    if (v.done) result = v.total;
  } else if (step.part === 'doubles') {
    const hit = dart.hit.segment === step.n && dart.hit.isDouble;
    visits = addDart(s.visits, 0, dart, hit ? 1 : 0);
    const v = visits[visits.length - 1]!;
    if (v.done) result = v.total;
  } else {
    visits = addDart(s.visits, 0, dart, dart.hit.score);
    const left = s.remaining - dart.hit.score;
    const v = visits[visits.length - 1]!;
    if (left === 0 && dart.hit.isDouble) result = 1;
    else if (left < 2 || v.done) result = 0;
    else remaining = left;
    if (result !== null) {
      visits = endVisit(visits);
      if (result === 0 && left < 2) {
        visits = [...visits.slice(0, -1), { ...visits[visits.length - 1]!, bust: true }];
      }
    }
  }
  if (result === null) return { ...s, visits, remaining };
  const results = [...s.results, result];
  const next = s.step + 1;
  const after = STEPS[next];
  return {
    ...s,
    visits,
    results,
    step: next,
    remaining: after?.part === 'checkouts' ? after.n : 0,
    over: next === STEPS.length,
  };
}

/** The raw figure for each part so far: average, double rate, finishes. */
export function assessmentFigures(s: AssessmentState): Record<AssessedSkill, number> {
  const by = (part: Step['part']) => s.results.filter((_, i) => STEPS[i]!.part === part);
  const scoring = by('scoring');
  const doubles = by('doubles');
  return {
    scoring: scoring.length ? scoring.reduce((a, b) => a + b, 0) / scoring.length : 0,
    doubles: doubles.length ? doubles.reduce((a, b) => a + b, 0) / (doubles.length * 3) : 0,
    checkouts: by('checkouts').reduce((a, b) => a + b, 0),
  };
}

export function assessmentLevels(s: AssessmentState): Record<AssessedSkill, number> {
  const f = assessmentFigures(s);
  return {
    scoring: levelFor('scoring', f.scoring),
    doubles: levelFor('doubles', f.doubles),
    checkouts: levelFor('checkouts', f.checkouts),
  };
}

const total = (s: AssessmentState) => {
  if (!s.over) return 0;
  const l = assessmentLevels(s);
  return l.scoring + l.doubles + l.checkouts;
};

function targetFor(s: AssessmentState): Target | null {
  if (s.over) return null;
  const step = STEPS[s.step]!;
  if (step.part === 'scoring') return { segment: 20, multiplier: 3 };
  if (step.part === 'doubles') return { segment: step.n, multiplier: 2 };
  const thrown =
    s.visits[s.visits.length - 1]?.done === false ? s.visits[s.visits.length - 1]!.darts.length : 0;
  return checkoutRoute(s.remaining, 3 - thrown)?.[0] ?? setupTarget(s.remaining);
}

function prompt(s: AssessmentState): DrillPrompt | null {
  if (s.over) return null;
  const step = STEPS[s.step]!;
  return step.part === 'checkouts'
    ? { kind: 'part', part: 'checkouts', remaining: s.remaining }
    : { kind: 'part', part: step.part };
}

function stats(s: AssessmentState): StatLine[] {
  const f = assessmentFigures(s);
  const l = assessmentLevels(s);
  return [
    { key: 'scoringLevel', value: l.scoring, format: 'int' },
    { key: 'doublesLevel', value: l.doubles, format: 'int' },
    { key: 'checkoutsLevel', value: l.checkouts, format: 'int' },
    { key: 'average', value: f.scoring, format: 'one' },
    { key: 'doublesRate', value: f.doubles, format: 'pct' },
    { key: 'finishes', value: f.checkouts, format: 'int' },
  ];
}

const steps = (s: AssessmentState): DrillStep[] =>
  STEPS.map((step, i) => ({
    label:
      step.part === 'scoring' ? 'T20' : step.part === 'doubles' ? `D${step.n}` : String(step.n),
    state:
      i < s.results.length
        ? s.results[i]! > 0
          ? 'done'
          : 'missed'
        : i === s.step && !s.over
          ? 'current'
          : 'todo',
  }));

export const assessment: DrillDefinition<Record<string, never>, AssessmentState> = {
  id: 'assessment',
  skill: 'assessment',
  better: 'higher',
  defaults: {},
  init: (_s, players) => ({
    player: onePlayer(players, 'The skill assessment'),
    visits: [],
    step: 0,
    results: [],
    remaining: 0,
    over: false,
  }),
  applyDart,
  currentPlayer: (s) => (s.over ? null : s.player),
  view: (s) =>
    soloView(s.player, s.visits, total(s), s.over, {
      n: Math.min(s.step + 1, STEPS.length),
      of: STEPS.length,
    }),
  targetFor,
  result: (s) => soloResult(s.player, s.over, total(s)),
  visits: (s) => s.visits,
  stats,
  score: total,
  steps,
  failed: () => false,
  prompt,
};
