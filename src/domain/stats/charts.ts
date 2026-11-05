// The numbers behind the charts (docs/design/stats.md): pure functions over darts, visits and
// replay frames, so every chart is derived from the dart log (ADR 0006).
import { SEGMENT_ORDER } from '../board';
import { BULL, type DartEvent, type PlayerRef, type Target } from '../darts';
import type { CricketDetail, GameDefinition, ReplayFrame, ScoreboardRow } from '../games';

/**
 * The worm: each player's score after every visit of a leg, starting from where the leg
 * began. `series[p][k]` is player p's score after the k-th visit (k = 0 is the start), so every
 * line has `frames.length + 1` points and the lines share the x axis.
 */
export function worm(
  start: number[],
  frames: readonly ReplayFrame[],
  pick: (row: ScoreboardRow) => number = (r) => r.score,
): number[][] {
  const series = start.map((s) => [s]);
  for (const f of frames) {
    series.forEach((line, p) => {
      const row = f.rows[p];
      line.push(row ? pick(row) : line[line.length - 1]!);
    });
  }
  return series;
}

/** Visit totals in the bands the visit histogram shows. */
export const VISIT_BANDS = [
  { key: 'under40', lo: 0, hi: 39 },
  { key: 'forties', lo: 40, hi: 59 },
  { key: 'sixties', lo: 60, hi: 79 },
  { key: 'eighties', lo: 80, hi: 99 },
  { key: 'ton', lo: 100, hi: 139 },
  { key: 'ton40', lo: 140, hi: 179 },
  { key: 'max', lo: 180, hi: 180 },
] as const;
export type VisitBand = (typeof VISIT_BANDS)[number]['key'];

/** How many visits fell in each band; busts count as nothing scored. */
export function visitBands(totals: readonly number[]): Record<VisitBand, number> {
  const out = Object.fromEntries(VISIT_BANDS.map((b) => [b.key, 0])) as Record<VisitBand, number>;
  for (const t of totals) {
    const band = VISIT_BANDS.find((b) => t >= b.lo && t <= b.hi);
    if (band) out[band.key]++;
  }
  return out;
}

export interface TargetRate {
  /** 1–20, or 25 for the bull. */
  segment: number;
  darts: number;
  hits: number;
  /** hits ÷ darts. */
  rate: number;
}

/** Whether a dart hit what it was aimed at: a single target takes any ring of its number. */
export function hitIntended(d: DartEvent): boolean {
  const t = d.intended;
  if (!t || d.hit.segment !== t.segment) return false;
  return t.multiplier === 1 ? true : d.hit.multiplier === t.multiplier;
}

/** Rates per aimed number, for darts aimed at that kind of target (doubles, trebles, any). */
export function targetRates(
  darts: readonly DartEvent[],
  kind: Target['multiplier'] | 'any' = 'any',
): TargetRate[] {
  const by = new Map<number, { darts: number; hits: number }>();
  for (const d of darts) {
    const t = d.intended;
    if (!t || d.source === 'bot') continue;
    if (kind !== 'any' && t.multiplier !== kind) continue;
    const e = by.get(t.segment) ?? { darts: 0, hits: 0 };
    e.darts++;
    if (hitIntended(d)) e.hits++;
    by.set(t.segment, e);
  }
  return [...by.entries()].map(([segment, e]) => ({ segment, ...e, rate: e.hits / e.darts }));
}

/**
 * The double ladder: each double you aimed at, best rate first (more attempts breaks a tie).
 * The bull counts as a double: it finishes a leg.
 */
export function doubleLadder(darts: readonly DartEvent[]): TargetRate[] {
  return targetRates(darts, 2).sort((a, b) => b.rate - a.rate || b.darts - a.darts);
}

/** Visits per player in order, as round totals: `rounds[p][r]` is p's total in round r. */
export function roundTotals(frames: readonly ReplayFrame[], players: number): number[][] {
  const out = Array.from({ length: players }, () => [] as number[]);
  for (const f of frames) out[f.player]?.push(f.bust ? 0 : f.total);
  return out;
}

export interface ClosingGrid {
  /** The numbers in play, as the scoreboard lists them (25 is the bull). */
  numbers: number[];
  /** closed[p][i]: the round (from 1) in which player p closed numbers[i], or null. */
  closed: (number | null)[][];
  rounds: number;
}

/**
 * When each player closed each number, for the Cricket family. Folds the game visit by visit
 * and reads the marks grid the scoreboard shows; null for games without one.
 */
export function closingGrid(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): ClosingGrid | null {
  let state = def.init(settings, players);
  const first = def.view(state).detail;
  if (first?.kind !== 'cricket') return null;
  const n = players.length;
  let numbers = first.numbers;
  const closed: (number | null)[][] = players.map(() => numbers.map(() => null));
  let rounds = 0;
  for (const d of [...darts].sort((a, b) => a.seq - b.seq)) {
    state = def.applyDart(state, d);
    const visits = def.visits(state);
    const v = visits[visits.length - 1];
    if (!v) continue;
    const round = Math.floor((visits.length - 1) / n) + 1;
    rounds = Math.max(rounds, round);
    const detail = def.view(state).detail as CricketDetail | undefined;
    if (detail?.kind !== 'cricket') continue;
    // Random Cricket draws its numbers at the start; take them as the game shows them.
    numbers = detail.numbers;
    detail.marks.forEach((row, p) =>
      row.forEach((m, i) => {
        if (m >= 3 && closed[p]![i] === null) closed[p]![i] = round;
      }),
    );
  }
  return { numbers, closed, rounds };
}

/** Where a dart aimed at a treble went. */
export type MissSide = 'bed' | 'high' | 'low' | 'left' | 'right' | 'other';

/**
 * Where darts aimed at a treble landed: in the bed, above or below it in the same number, in the
 * numbers either side, or elsewhere. Only darts with a position count (tapped or camera),
 * because a keypad single doesn't say which side of the treble it was.
 */
export function missSplit(
  darts: readonly DartEvent[],
  segment = 20,
): { counts: Record<MissSide, number>; total: number } {
  const i = SEGMENT_ORDER.indexOf(segment as (typeof SEGMENT_ORDER)[number]);
  const n = SEGMENT_ORDER.length;
  const left = SEGMENT_ORDER[(i - 1 + n) % n];
  const right = SEGMENT_ORDER[(i + 1) % n];
  const counts: Record<MissSide, number> = {
    bed: 0,
    high: 0,
    low: 0,
    left: 0,
    right: 0,
    other: 0,
  };
  let total = 0;
  for (const d of darts) {
    const t = d.intended;
    if (!t || t.segment !== segment || t.multiplier !== 3) continue;
    if (d.source === 'bot' || d.precision !== 'exact') continue;
    total++;
    const h = d.hit;
    if (h.segment === segment) {
      if (h.ring === 'treble') counts.bed++;
      else if (h.ring === 'innerSingle') counts.low++;
      else counts.high++;
    } else if (h.segment === left) counts.left++;
    else if (h.segment === right) counts.right++;
    else counts.other++;
  }
  return { counts, total };
}

export interface Trend {
  /** Index of the best score, by the drill's direction. */
  best: number | null;
  average: number | null;
  /** Average of the last ten. */
  recent: number | null;
  last: number | null;
}

const mean = (xs: readonly number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

/** Best, average, recent average and last of a run of scores, oldest first. */
export function trend(scores: readonly number[], better: 'higher' | 'lower' = 'higher'): Trend {
  let best: number | null = null;
  scores.forEach((s, i) => {
    if (best === null || (better === 'higher' ? s > scores[best]! : s < scores[best]!)) best = i;
  });
  return {
    best,
    average: mean(scores),
    recent: mean(scores.slice(-10)),
    last: scores.length ? scores[scores.length - 1]! : null,
  };
}

/** Finish rates by score band, for the checkout drills. */
export const FINISH_BANDS = [
  [2, 40],
  [41, 60],
  [61, 80],
  [81, 100],
  [101, 130],
  [131, 170],
] as const;

export interface FinishAttempt {
  target: number;
  finished: boolean;
  darts: number;
}

export interface FinishBand {
  lo: number;
  hi: number;
  attempts: number;
  finished: number;
  /** Darts used per finish, or null with none. */
  dartsPerFinish: number | null;
}

/** Attempts grouped into bands; bands nobody tried are left out. */
export function finishBands(
  attempts: readonly FinishAttempt[],
  bands: readonly (readonly [number, number])[] = FINISH_BANDS,
): FinishBand[] {
  return bands.flatMap(([lo, hi]) => {
    const inBand = attempts.filter((a) => a.target >= lo && a.target <= hi);
    if (inBand.length === 0) return [];
    const done = inBand.filter((a) => a.finished);
    const darts = done.reduce((s, a) => s + a.darts, 0);
    return [
      {
        lo,
        hi,
        attempts: inBand.length,
        finished: done.length,
        dartsPerFinish: done.length ? darts / done.length : null,
      },
    ];
  });
}

/** The finishes you miss most: tried at least twice, lowest finish rate first. */
export function missedFinishes(
  attempts: readonly FinishAttempt[],
  limit = 4,
): { target: number; attempts: number; finished: number }[] {
  const by = new Map<number, { attempts: number; finished: number }>();
  for (const a of attempts) {
    const e = by.get(a.target) ?? { attempts: 0, finished: 0 };
    e.attempts++;
    if (a.finished) e.finished++;
    by.set(a.target, e);
  }
  return [...by.entries()]
    .map(([target, e]) => ({ target, ...e }))
    .filter((e) => e.attempts >= 2 && e.finished < e.attempts)
    .sort(
      (a, b) =>
        a.finished / a.attempts - b.finished / b.attempts ||
        b.attempts - a.attempts ||
        b.target - a.target,
    )
    .slice(0, limit);
}

/** The board's numbers in order round from the top, for the number wheel. */
export const WHEEL_ORDER: readonly number[] = SEGMENT_ORDER;
export { BULL };
