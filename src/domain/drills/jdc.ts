// The JDC Challenge (docs/research/training.md → Assessment), as the Junior Darts Corporation
// grades it: Shanghai on 10 to 15, one dart at each double and the bull, then Shanghai on 15 to
// 20. Shanghai rounds score the number times the ring, plus 100 for a single, double and treble
// in the visit; each double hit scores 50.
import { BULL, label, type DartEvent, type Hit, type PlayerRef, type Target } from '../darts';
import type { GameVisit, StatLine } from '../games/types';
import { addDart, checkPlayer } from '../games/visits';

import { onePlayer, soloResult, soloView } from './kit';
import type { DrillDefinition, DrillStep } from './types';

type Part = { kind: 'shanghai'; n: number } | { kind: 'double'; n: number };

export const JDC_PARTS: Part[] = [
  ...[10, 11, 12, 13, 14, 15].map((n) => ({ kind: 'shanghai' as const, n })),
  ...[...Array.from({ length: 20 }, (_, i) => i + 1), BULL].map((n) => ({
    kind: 'double' as const,
    n,
  })),
  ...[15, 16, 17, 18, 19, 20].map((n) => ({ kind: 'shanghai' as const, n })),
];
export const SHANGHAI_BONUS = 100;
export const DOUBLE_POINTS = 50;

export interface JdcState {
  player: PlayerRef;
  visits: GameVisit[];
  /** Index into JDC_PARTS. */
  part: number;
  /** Points for each finished part. */
  points: number[];
  /** Darts thrown at the part in play. */
  inPart: Hit[];
  over: boolean;
}

const dartsFor = (p: Part) => (p.kind === 'shanghai' ? 3 : 1);
const onDouble = (h: Hit, n: number) => h.segment === n && h.isDouble;

function partPoints(p: Part, darts: Hit[]): number {
  if (p.kind === 'double') return darts.some((h) => onDouble(h, p.n)) ? DOUBLE_POINTS : 0;
  const on = darts.filter((h) => h.segment === p.n);
  const rings = new Set(on.map((h) => h.multiplier));
  const bonus = rings.has(1) && rings.has(2) && rings.has(3) ? SHANGHAI_BONUS : 0;
  return on.reduce((n, h) => n + h.score, 0) + bonus;
}

function applyDart(s: JdcState, dart: DartEvent): JdcState {
  if (s.over) throw new Error('The drill is over');
  checkPlayer(s.player.id, dart);
  const p = JDC_PARTS[s.part]!;
  const inPart = [...s.inPart, dart.hit];
  const counts =
    p.kind === 'double'
      ? onDouble(dart.hit, p.n)
        ? DOUBLE_POINTS
        : 0
      : dart.hit.segment === p.n
        ? dart.hit.score
        : 0;
  const visits = addDart(s.visits, 0, dart, counts);
  if (inPart.length < dartsFor(p)) return { ...s, visits, inPart };
  const points = [...s.points, partPoints(p, inPart)];
  const part = s.part + 1;
  return { ...s, visits, points, part, inPart: [], over: part === JDC_PARTS.length };
}

const total = (s: JdcState) =>
  s.points.reduce((a, b) => a + b, 0) +
  (s.over
    ? 0
    : s.inPart.reduce(
        (n, h) =>
          n +
          (JDC_PARTS[s.part]!.kind === 'shanghai' && h.segment === JDC_PARTS[s.part]!.n
            ? h.score
            : 0),
        0,
      ));

function targetFor(s: JdcState): Target | null {
  if (s.over) return null;
  const p = JDC_PARTS[s.part]!;
  return p.kind === 'double' ? { segment: p.n, multiplier: 2 } : { segment: p.n, multiplier: 3 };
}

function stats(s: JdcState): StatLine[] {
  const doubles = JDC_PARTS.flatMap((p, i) =>
    p.kind === 'double' && i < s.points.length ? [s.points[i]!] : [],
  );
  const shanghais = JDC_PARTS.filter(
    (p, i) => p.kind === 'shanghai' && (s.points[i] ?? 0) >= SHANGHAI_BONUS,
  ).length;
  return [
    { key: 'drillScore', value: total(s), format: 'int' },
    { key: 'doublesHit', value: doubles.filter((x) => x > 0).length, format: 'int' },
    { key: 'shanghais', value: shanghais, format: 'int' },
  ];
}

const steps = (s: JdcState): DrillStep[] =>
  JDC_PARTS.map((p, i) => ({
    label: p.kind === 'double' ? label({ segment: p.n, multiplier: 2 }) : String(p.n),
    state:
      i < s.points.length
        ? s.points[i]! > 0
          ? 'done'
          : 'missed'
        : i === s.part && !s.over
          ? 'current'
          : 'todo',
    value: s.points[i],
  }));

export const jdc: DrillDefinition<Record<string, never>, JdcState> = {
  id: 'jdc',
  skill: 'assessment',
  better: 'higher',
  defaults: {},
  init: (_s, players) => ({
    player: onePlayer(players, 'The JDC Challenge'),
    visits: [],
    part: 0,
    points: [],
    inPart: [],
    over: false,
  }),
  applyDart,
  currentPlayer: (s) => (s.over ? null : s.player),
  view: (s) => soloView(s.player, s.visits, total(s), s.over),
  targetFor,
  result: (s) => soloResult(s.player, s.over, total(s)),
  visits: (s) => s.visits,
  stats,
  score: total,
  steps,
  failed: () => false,
};
