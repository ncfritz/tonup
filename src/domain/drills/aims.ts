// Drills at fixed targets (docs/research/training.md): 100 darts at T20, the Bullseye drill,
// Checkouts Practice, Doubles Lock and 170 Practice.
import { BULL, label, type DartEvent, type Hit, type PlayerRef, type Target } from '../darts';
import type { GameVisit, StatLine } from '../games/types';
import { addDart, checkPlayer, endVisit } from '../games/visits';

import { dartsThrown, onePlayer, soloResult, soloView } from './kit';
import type { DrillDefinition, DrillStep } from './types';

const T20: Target = { segment: 20, multiplier: 3 };
const BULLSEYE: Target = { segment: BULL, multiplier: 2 };
const D = (n: number): Target => ({ segment: n, multiplier: 2 });

const isExactly = (hit: Hit, t: Target) =>
  hit.segment === t.segment && hit.multiplier === t.multiplier;
const isBull = (hit: Hit) => hit.segment === BULL;

/** Shared state for a run of darts at one target, counting hits. */
interface CountState {
  settings: { darts: number };
  player: PlayerRef;
  visits: GameVisit[];
  hits: number;
  /** Hits per dart, in order (for the strip and stats). */
  marks: boolean[];
  points: number;
  over: boolean;
}

function countDrill(args: {
  id: 't20' | 'bullseye';
  name: string;
  skill: 'scoring' | 'accuracy';
  darts: number;
  target: Target;
  counts: (hit: Hit) => boolean;
  /** Strip blocks of this many darts. */
  block: number;
  stats: (s: CountState) => StatLine[];
}): DrillDefinition<{ darts: number }, CountState> {
  const init = (settings: { darts: number }, players: PlayerRef[]): CountState => ({
    settings,
    player: onePlayer(players, args.name),
    visits: [],
    hits: 0,
    marks: [],
    points: 0,
    over: false,
  });
  const applyDart = (s: CountState, dart: DartEvent): CountState => {
    if (s.over) throw new Error('The drill is over');
    checkPlayer(s.player.id, dart);
    const hit = args.counts(dart.hit);
    let visits = addDart(s.visits, 0, dart, hit ? 1 : 0);
    const marks = [...s.marks, hit];
    const over = marks.length >= s.settings.darts;
    if (over) visits = endVisit(visits);
    return {
      ...s,
      visits,
      marks,
      hits: s.hits + (hit ? 1 : 0),
      points: s.points + dart.hit.score,
      over,
    };
  };
  const steps = (s: CountState): DrillStep[] =>
    Array.from({ length: Math.ceil(s.settings.darts / args.block) }, (_, i) => {
      const from = i * args.block;
      const block = s.marks.slice(from, from + args.block);
      const full = block.length === Math.min(args.block, s.settings.darts - from);
      return {
        label: String(from + args.block),
        state: full ? 'done' : from <= s.marks.length && !s.over ? 'current' : 'todo',
        value: block.length ? block.filter(Boolean).length : undefined,
      };
    });
  return {
    id: args.id,
    skill: args.skill,
    better: 'higher',
    defaults: { darts: args.darts },
    init,
    applyDart,
    currentPlayer: (s) => (s.over ? null : s.player),
    view: (s) =>
      soloView(s.player, s.visits, s.hits, s.over, {
        n: Math.min(Math.floor(s.marks.length / 3) + 1, Math.ceil(s.settings.darts / 3)),
        of: Math.ceil(s.settings.darts / 3),
      }),
    targetFor: (s) => (s.over ? null : args.target),
    result: (s) => soloResult(s.player, s.over, s.hits),
    visits: (s) => s.visits,
    stats: args.stats,
    score: (s) => s.hits,
    steps,
    failed: () => false,
  };
}

const rate = (s: CountState) => (s.marks.length ? s.hits / s.marks.length : null);

/** 100 darts at T20: the hit rate on the treble, and what the darts scored. */
export const t20 = countDrill({
  id: 't20',
  name: '100 darts at T20',
  skill: 'scoring',
  darts: 100,
  target: T20,
  counts: (h) => isExactly(h, T20),
  block: 10,
  stats: (s) => [
    { key: 'trebles', value: s.hits, format: 'int' },
    { key: 'hitRate', value: rate(s), format: 'pct' },
    {
      key: 'average',
      value: s.marks.length ? (s.points / s.marks.length) * 3 : null,
      format: 'one',
    },
  ],
});

/** The Bullseye drill: 30 darts at the bull; either bull counts, bullseyes are shown too. */
export const bullseye = countDrill({
  id: 'bullseye',
  name: 'The Bullseye drill',
  skill: 'accuracy',
  darts: 30,
  target: BULLSEYE,
  counts: isBull,
  block: 3,
  stats: (s) => {
    const inner = s.visits.flatMap((v) => v.darts).filter((d) => d.hit.ring === 'innerBull').length;
    return [
      { key: 'bulls', value: s.hits, format: 'int' },
      { key: 'bullseyes', value: inner, format: 'int' },
      { key: 'hitRate', value: rate(s), format: 'pct' },
    ];
  },
});

// Checkouts Practice: three darts at each of the doubles players finish on most, high to low.

export const CHECKOUT_DOUBLES = [20, 18, 16, 14, 12, 10, 8, 6, 4, 2];

interface RoundsState {
  player: PlayerRef;
  visits: GameVisit[];
  /** Hits in each finished round. */
  hits: number[];
  round: number;
  score: number;
  over: boolean;
}

function roundsInit(players: PlayerRef[], name: string): RoundsState {
  return {
    player: onePlayer(players, name),
    visits: [],
    hits: [],
    round: 0,
    score: 0,
    over: false,
  };
}

export const checkoutsPractice: DrillDefinition<Record<string, never>, RoundsState> = {
  id: 'checkouts',
  skill: 'doubles',
  better: 'higher',
  defaults: {},
  init: (_s, players) => roundsInit(players, 'Checkouts Practice'),
  applyDart: (s, dart) => {
    if (s.over) throw new Error('The drill is over');
    checkPlayer(s.player.id, dart);
    const n = CHECKOUT_DOUBLES[s.round]!;
    const hit = isExactly(dart.hit, D(n));
    const visits = addDart(s.visits, 0, dart, hit ? n * 2 : 0);
    const v = visits[visits.length - 1]!;
    const score = s.score + (hit ? n * 2 : 0);
    if (!v.done) return { ...s, visits, score };
    const hits = [...s.hits, v.darts.filter((d) => isExactly(d.hit, D(n))).length];
    const round = s.round + 1;
    return { ...s, visits, score, hits, round, over: round === CHECKOUT_DOUBLES.length };
  },
  currentPlayer: (s) => (s.over ? null : s.player),
  view: (s) =>
    soloView(s.player, s.visits, s.score, s.over, {
      n: Math.min(s.round + 1, CHECKOUT_DOUBLES.length),
      of: CHECKOUT_DOUBLES.length,
    }),
  targetFor: (s) => (s.over ? null : D(CHECKOUT_DOUBLES[s.round]!)),
  result: (s) => soloResult(s.player, s.over, s.score),
  visits: (s) => s.visits,
  stats: (s) => {
    const darts = dartsThrown(s.visits);
    const hit = s.hits.reduce((a, b) => a + b, 0);
    return [
      { key: 'drillScore', value: s.score, format: 'int' },
      { key: 'doublesRate', value: darts ? hit / darts : null, format: 'pct' },
    ];
  },
  score: (s) => s.score,
  steps: (s) =>
    CHECKOUT_DOUBLES.map((n, i) => ({
      label: label(D(n)),
      state:
        i < s.hits.length
          ? s.hits[i]! > 0
            ? 'done'
            : 'missed'
          : i === s.round && !s.over
            ? 'current'
            : 'todo',
      value: i < s.hits.length ? s.hits[i]! * n * 2 : undefined,
    })),
  failed: () => false,
};

// Doubles Lock: D20 down to D1. A hit moves you down one; a visit with no hit sends you back to
// the last lock you reached (D15, D10 and D5). Fewer darts is better.

export const LOCKS = [20, 15, 10, 5];
/** A run that hasn't finished by then stops, so a bad day still ends. */
export const DOUBLES_LOCK_CAP = 300;

interface SequenceState {
  player: PlayerRef;
  visits: GameVisit[];
  /** Index of the target in play. */
  at: number;
  /** Doubles Lock: the furthest lock reached. */
  lock: number;
  /** Times you fell back. */
  falls: number;
  done: boolean;
  failed: boolean;
}

const seqInit = (players: PlayerRef[], name: string): SequenceState => ({
  player: onePlayer(players, name),
  visits: [],
  at: 0,
  lock: 0,
  falls: 0,
  done: false,
  failed: false,
});
const seqOver = (s: SequenceState) => s.done || s.failed;

/** Doubles Lock's targets: D20 to D1. */
export const LOCK_DOUBLES = Array.from({ length: 20 }, (_, i) => 20 - i);

export const doublesLock: DrillDefinition<Record<string, never>, SequenceState> = {
  id: 'doublesLock',
  skill: 'doubles',
  better: 'lower',
  defaults: {},
  init: (_s, players) => seqInit(players, 'Doubles Lock'),
  applyDart: (s, dart) => {
    if (seqOver(s)) throw new Error('The drill is over');
    checkPlayer(s.player.id, dart);
    const n = LOCK_DOUBLES[s.at]!;
    const hit = isExactly(dart.hit, D(n));
    let visits = addDart(s.visits, 0, dart, hit ? 1 : 0);
    let at = hit ? s.at + 1 : s.at;
    const lock = LOCKS.includes(LOCK_DOUBLES[at] ?? 0) ? Math.max(s.lock, at) : s.lock;
    if (at === LOCK_DOUBLES.length) {
      return { ...s, visits: endVisit(visits), at, lock, done: true };
    }
    const v = visits[visits.length - 1]!;
    let falls = s.falls;
    if (v.done && v.total === 0 && at > lock) {
      at = lock;
      falls += 1;
      visits = [...visits.slice(0, -1), { ...v, bust: true }];
    }
    const failed = dartsThrown(visits) >= DOUBLES_LOCK_CAP;
    return { ...s, visits: failed ? endVisit(visits) : visits, at, lock, falls, failed };
  },
  currentPlayer: (s) => (seqOver(s) ? null : s.player),
  view: (s) => soloView(s.player, s.visits, dartsThrown(s.visits), seqOver(s)),
  targetFor: (s) => (seqOver(s) ? null : D(LOCK_DOUBLES[s.at]!)),
  result: (s) => soloResult(s.player, seqOver(s), dartsThrown(s.visits)),
  visits: (s) => s.visits,
  stats: (s) => {
    const darts = dartsThrown(s.visits);
    return [
      { key: 'dartsToFinish', value: darts, format: 'int' },
      { key: 'doublesRate', value: darts ? hitsOf(s) / darts : null, format: 'pct' },
      { key: 'fallBacks', value: s.falls, format: 'int' },
    ];
  },
  score: (s) => dartsThrown(s.visits),
  steps: (s) =>
    LOCK_DOUBLES.map((n, i) => ({
      label: label(D(n)),
      state: i < s.at ? 'done' : i === s.at && !seqOver(s) ? 'current' : 'todo',
    })),
  failed: (s) => s.failed,
};

function hitsOf(s: SequenceState): number {
  return s.visits.reduce((n, v) => n + v.total, 0);
}

// 170 Practice: T20, T20 and the bull, in that order, in as few darts as you can.

export const ONE_SEVENTY: Target[] = [T20, T20, BULLSEYE];
export const ONE_SEVENTY_CAP = 150;

export const oneSeventy: DrillDefinition<Record<string, never>, SequenceState> = {
  id: 'oneSeventy',
  skill: 'checkouts',
  better: 'lower',
  defaults: {},
  init: (_s, players) => seqInit(players, '170 Practice'),
  applyDart: (s, dart) => {
    if (seqOver(s)) throw new Error('The drill is over');
    checkPlayer(s.player.id, dart);
    const hit = isExactly(dart.hit, ONE_SEVENTY[s.at]!);
    const visits = addDart(s.visits, 0, dart, hit ? 1 : 0);
    const at = hit ? s.at + 1 : s.at;
    if (at === ONE_SEVENTY.length) return { ...s, visits: endVisit(visits), at, done: true };
    const failed = dartsThrown(visits) >= ONE_SEVENTY_CAP;
    return { ...s, visits: failed ? endVisit(visits) : visits, at, failed };
  },
  currentPlayer: (s) => (seqOver(s) ? null : s.player),
  view: (s) => soloView(s.player, s.visits, dartsThrown(s.visits), seqOver(s)),
  targetFor: (s) => (seqOver(s) ? null : ONE_SEVENTY[s.at]!),
  result: (s) => soloResult(s.player, seqOver(s), dartsThrown(s.visits)),
  visits: (s) => s.visits,
  stats: (s) => {
    const darts = dartsThrown(s.visits);
    return [
      { key: 'dartsToFinish', value: darts, format: 'int' },
      { key: 'hitRate', value: darts ? hitsOf(s) / darts : null, format: 'pct' },
    ];
  },
  score: (s) => dartsThrown(s.visits),
  steps: (s) =>
    ONE_SEVENTY.map((t, i) => ({
      label: label(t),
      state: i < s.at ? 'done' : i === s.at && !seqOver(s) ? 'current' : 'todo',
    })),
  failed: (s) => s.failed,
};
