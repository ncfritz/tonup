// Checkout drills (docs/research/training.md → Checkouts): finish a run of scores on a double
// with a few darts each. Catch 40 (61–100, six darts), Hubbe (101–130, three), 121 (nine darts,
// the target climbs when you finish), Random Checkout (twenty dealt finishes, three darts) and
// Pressure (a bot is waiting on a finish: one visit to take the leg).
import type { Rng } from '../bot/rng';
import { checkoutRoute, setupTarget } from '../checkout';
import type { DartEvent, PlayerRef, Target } from '../darts';
import type { GameVisit, StatLine } from '../games/types';
import { addDart, checkPlayer, dartsInVisit, endVisit } from '../games/visits';

import { onePlayer, soloResult, soloView } from './kit';
import type { DrillDefinition, DrillId, DrillPrompt, DrillStep } from './types';

export interface CheckoutSettings {
  /** The scores to finish, in order; dealt at the start for Random Checkout and Pressure. */
  targets?: number[];
  /** Pressure: what the bot is waiting on for each leg. */
  botOn?: number[];
}

export interface Attempt {
  target: number;
  finished: boolean;
  darts: number;
}

export interface CheckoutState {
  settings: CheckoutSettings;
  player: PlayerRef;
  visits: GameVisit[];
  attempts: Attempt[];
  /** What's left on the target in play. */
  remaining: number;
  /** The score at the start of this visit, which a bust goes back to. */
  visitStart: number;
  /** Darts thrown at the target in play. */
  used: number;
  over: boolean;
}

interface Config {
  id: DrillId;
  name: string;
  /** Darts allowed at each target. */
  darts: number;
  /** How many targets the drill has. */
  rounds: (s: CheckoutSettings) => number;
  /** The target for the next round, given the attempts so far. */
  target: (s: CheckoutSettings, attempts: Attempt[]) => number;
  /** Points for one attempt. */
  points: (a: Attempt) => number;
  /** The drill's score; the sum of points by default. */
  score?: (attempts: Attempt[]) => number;
  deal?: (rng: Rng) => CheckoutSettings;
  pressure?: boolean;
}

/** Scores with a three-dart double-out finish, from `lo` to `hi`. */
export function finishable(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let n = lo; n <= hi; n++) if (checkoutRoute(n, 3)) out.push(n);
  return out;
}

/** `count` scores drawn from a list, each at most once while the list lasts. */
export function draw(list: number[], count: number, rng: Rng): number[] {
  const pool = [...list];
  const out: number[] = [];
  while (out.length < count) {
    if (pool.length === 0) pool.push(...list);
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return out;
}

function checkoutDrill(c: Config): DrillDefinition<CheckoutSettings, CheckoutState> {
  const sum = (a: Attempt[]) => a.reduce((n, x) => n + c.points(x), 0);
  const score = (s: CheckoutState) => (c.score ?? sum)(s.attempts);

  const init = (settings: CheckoutSettings, players: PlayerRef[]): CheckoutState => {
    const player = onePlayer(players, c.name);
    if (c.rounds(settings) < 1) throw new RangeError(`${c.name} needs targets`);
    const first = c.target(settings, []);
    return {
      settings,
      player,
      visits: [],
      attempts: [],
      remaining: first,
      visitStart: first,
      used: 0,
      over: false,
    };
  };

  const applyDart = (s: CheckoutState, dart: DartEvent): CheckoutState => {
    if (s.over) throw new Error('The drill is over');
    checkPlayer(s.player.id, dart);
    const left = s.remaining - dart.hit.score;
    const finished = left === 0 && dart.hit.isDouble;
    const bust = !finished && left < 2;
    let visits = addDart(s.visits, 0, dart, dart.hit.score);
    const used = s.used + 1;
    let remaining = bust ? s.visitStart : left;
    let visitStart = s.visitStart;
    if (bust) {
      const v = visits[visits.length - 1]!;
      visits = [...visits.slice(0, -1), { ...v, bust: true, done: true }];
    }
    if (finished || used >= c.darts) {
      const target = c.target(s.settings, s.attempts);
      const attempts = [...s.attempts, { target, finished, darts: used }];
      visits = endVisit(visits);
      if (attempts.length >= c.rounds(s.settings)) {
        return { ...s, visits, attempts, remaining: 0, used, over: true };
      }
      const next = c.target(s.settings, attempts);
      return { ...s, visits, attempts, remaining: next, visitStart: next, used: 0 };
    }
    if (visits[visits.length - 1]!.done) visitStart = remaining;
    return { ...s, visits, remaining, visitStart, used };
  };

  const targetFor = (s: CheckoutState): Target | null => {
    if (s.over) return null;
    const inVisit = 3 - dartsInVisit(s.visits);
    const darts = Math.min(inVisit, c.darts - s.used);
    return checkoutRoute(s.remaining, darts)?.[0] ?? setupTarget(s.remaining);
  };

  const steps = (s: CheckoutState): DrillStep[] =>
    Array.from({ length: c.rounds(s.settings) }, (_, i) => {
      const a = s.attempts[i];
      if (a)
        return {
          label: String(a.target),
          state: a.finished ? 'done' : 'missed',
          value: c.points(a),
        };
      const current = i === s.attempts.length && !s.over;
      // Targets after the current one aren't known in 121 until you get there.
      const label = current
        ? String(c.target(s.settings, s.attempts))
        : c.id === 'oneTwentyOne'
          ? ''
          : String(c.target(s.settings, fill(s.attempts, i)));
      return { label, state: current ? 'current' : 'todo' };
    });

  const prompt = (s: CheckoutState): DrillPrompt | null => {
    if (s.over) return null;
    const dartsLeft = c.darts - s.used;
    if (c.pressure) {
      const botOn = s.settings.botOn?.[s.attempts.length] ?? 32;
      return { kind: 'pressure', remaining: s.remaining, dartsLeft, botOn };
    }
    return { kind: 'finish', remaining: s.remaining, dartsLeft };
  };

  const stats = (s: CheckoutState): StatLine[] => {
    const done = s.attempts.filter((a) => a.finished);
    const finishDarts = done.reduce((n, a) => n + a.darts, 0);
    return [
      { key: 'drillScore', value: score(s), format: 'int' },
      { key: 'finishes', value: done.length, format: 'int' },
      {
        key: 'finishRate',
        value: s.attempts.length ? done.length / s.attempts.length : null,
        format: 'pct',
      },
      {
        key: 'dartsPerFinish',
        value: done.length ? finishDarts / done.length : null,
        format: 'one',
      },
    ];
  };

  return {
    id: c.id,
    skill: 'checkouts',
    better: 'higher',
    defaults: {},
    init,
    applyDart,
    currentPlayer: (s) => (s.over ? null : s.player),
    view: (s) =>
      soloView(s.player, s.visits, s.remaining, s.over, {
        n: Math.min(s.attempts.length + 1, c.rounds(s.settings)),
        of: c.rounds(s.settings),
      }),
    targetFor,
    result: (s) => soloResult(s.player, s.over, score(s)),
    visits: (s) => s.visits,
    stats,
    score,
    steps,
    failed: () => false,
    deal: c.deal ? (settings, rng) => ({ ...settings, ...c.deal!(rng) }) : undefined,
    prompt,
  };
}

/** Attempts padded to `n` (for listing targets ahead in fixed-list drills). */
const fill = (a: Attempt[], n: number): Attempt[] =>
  Array.from({ length: n }, (_, i) => a[i] ?? { target: 0, finished: false, darts: 0 });

const listed = (list: (s: CheckoutSettings) => number[]) => ({
  rounds: (s: CheckoutSettings) => list(s).length,
  target: (s: CheckoutSettings, a: Attempt[]) => list(s)[a.length] ?? list(s)[0]!,
});

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** Catch 40: 61 to 100, six darts each; 3 points in two darts, 2 in three, 1 in four to six. */
export const catch40 = checkoutDrill({
  id: 'catch40',
  name: 'Catch 40',
  darts: 6,
  ...listed(() => range(61, 100)),
  points: (a) => (!a.finished ? 0 : a.darts <= 2 ? 3 : a.darts === 3 ? 2 : 1),
});

/** Hubbe: 101 to 130, three darts each, a point for every finish. */
export const hubbe = checkoutDrill({
  id: 'hubbe',
  name: 'Hubbe',
  darts: 3,
  ...listed(() => range(101, 130)),
  points: (a) => (a.finished ? 1 : 0),
});

/** 121: ten tries with nine darts each; a finish moves the target up one. Highest finish counts. */
export const ONE_TWENTY_ONE_TRIES = 10;
export const oneTwentyOne = checkoutDrill({
  id: 'oneTwentyOne',
  name: '121',
  darts: 9,
  rounds: () => ONE_TWENTY_ONE_TRIES,
  target: (_s, a) => 121 + a.filter((x) => x.finished).length,
  points: (a) => (a.finished ? 1 : 0),
  score: (a) => Math.max(0, ...a.filter((x) => x.finished).map((x) => x.target)),
});

const RANDOM_POOL = finishable(40, 170);
export const RANDOM_CHECKOUTS = 20;

/** Random Checkout: twenty finishes from 40 to 170, dealt at the start, three darts each. */
export const randomCheckout = checkoutDrill({
  id: 'randomCheckout',
  name: 'Random Checkout',
  darts: 3,
  ...listed((s) => s.targets ?? [100]),
  points: (a) => (a.finished ? 1 : 0),
  deal: (rng) => ({ targets: draw(RANDOM_POOL, RANDOM_CHECKOUTS, rng) }),
});

const PRESSURE_POOL = finishable(41, 130);
const BOT_FINISHES = [32, 40, 36, 16, 20, 24, 8, 12, 50, 18, 10, 4];
export const PRESSURE_LEGS = 10;

/** Pressure: ten legs where the bot is waiting on a double, so you have one visit to finish. */
export const pressure = checkoutDrill({
  id: 'pressure',
  name: 'Pressure',
  darts: 3,
  ...listed((s) => s.targets ?? [81]),
  points: (a) => (a.finished ? 1 : 0),
  deal: (rng) => ({
    targets: draw(PRESSURE_POOL, PRESSURE_LEGS, rng),
    botOn: draw(BOT_FINISHES, PRESSURE_LEGS, rng),
  }),
  pressure: true,
});
