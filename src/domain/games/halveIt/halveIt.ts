// Halve-It and Bermuda Triangle (docs/data/game-rules.md → Target-sequence games): one visit at
// each target in a list; hits add their value, and a visit with no hits halves your total
// (rounded up). Highest total wins.
import { BULL, type DartEvent, type Hit, type PlayerRef, type Target } from '../../darts';
import { ANY_DOUBLE, ANY_TREBLE } from '../cricket/cricket';
import { bestOf, simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, nextPlayer } from '../visits';

/** The usual lists. Bermuda Triangle's run is one common version (it's also sold as Double Down). */
export const HALVE_IT_LISTS = {
  halveIt: [20, 19, ANY_DOUBLE, 18, ANY_TREBLE, 17, BULL],
  bermuda: [12, 13, 14, ANY_DOUBLE, 15, 16, 17, ANY_TREBLE, 18, 19, 20, BULL],
} as const;

export interface HalveItSettings {
  list: keyof typeof HALVE_IT_LISTS;
}

export const HALVE_IT_DEFAULTS: HalveItSettings = { list: 'halveIt' };

export interface HalveItState {
  settings: HalveItSettings;
  players: PlayerRef[];
  targets: number[];
  scores: number[];
  /** Index of the target in play. */
  step: number;
  current: number;
  visits: GameVisit[];
  over: boolean;
  winner: number | null;
  halvings: number[];
}

/** Whether a dart counts for a target code (number, bull, any double, any treble). */
export function hitsTarget(code: number, hit: Hit): boolean {
  if (hit.ring === 'miss') return false;
  if (code === ANY_DOUBLE) return hit.isDouble;
  if (code === ANY_TREBLE) return hit.multiplier === 3;
  return hit.segment === code;
}

function init(settings: HalveItSettings, players: PlayerRef[]): HalveItState {
  if (players.length < 1) throw new RangeError('Halve-It needs a player');
  return {
    settings,
    players,
    targets: [...HALVE_IT_LISTS[settings.list]],
    scores: players.map(() => 0),
    step: 0,
    current: 0,
    visits: [],
    over: false,
    winner: null,
    halvings: players.map(() => 0),
  };
}

function applyDart(state: HalveItState, dart: DartEvent): HalveItState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const code = state.targets[state.step]!;
  const points = hitsTarget(code, dart.hit) ? dart.hit.score : 0;
  let visits = addDart(state.visits, p, dart, points);
  const v = visits[visits.length - 1]!;
  const scores = [...state.scores];
  scores[p] = scores[p]! + points;
  if (!v.done) return { ...state, scores, visits };
  const halvings = [...state.halvings];
  if (v.total === 0) {
    scores[p] = Math.ceil(scores[p]! / 2);
    halvings[p] = halvings[p]! + 1;
    visits = [...visits.slice(0, -1), { ...v, bust: true }];
  }
  const current = nextPlayer(p, state.players.length);
  const step = current === 0 ? state.step + 1 : state.step;
  if (step >= state.targets.length) {
    return {
      ...state,
      scores,
      halvings,
      visits,
      current,
      over: true,
      winner: bestOf(scores, 'higher'),
    };
  }
  return { ...state, scores, halvings, visits, current, step };
}

/** Where to aim at a target code. */
export function aimFor(code: number): Target {
  if (code === BULL) return { segment: BULL, multiplier: 1 };
  if (code === ANY_DOUBLE) return { segment: 20, multiplier: 2 };
  if (code === ANY_TREBLE) return { segment: 20, multiplier: 3 };
  return { segment: code, multiplier: 3 };
}

const stats = (s: HalveItState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  return [
    { key: 'points', value: s.scores[p] ?? 0, format: 'int' },
    { key: 'halvings', value: s.halvings[p] ?? 0, format: 'int' },
  ];
};

export const halveIt: GameDefinition<HalveItSettings, HalveItState> = {
  id: 'halveIt',
  family: 'sequence',
  defaults: HALVE_IT_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view: (s) =>
    simpleView({
      ...s,
      rows: s.scores.map((score) => ({ score })),
      round: { n: Math.min(s.step + 1, s.targets.length), of: s.targets.length },
      status: s.over
        ? undefined
        : { kind: 'aim', target: targetLabel(s.targets[s.step]!), reason: 'target' },
    }),
  targetFor: (s) => (s.over ? null : aimFor(s.targets[s.step]!)),
  result: (s) => simpleResult(s.players, s.over, s.winner, s.scores),
  visits: (s) => s.visits,
  stats,
};

/**
 * The target as shown in the strip. "Any double" and "any treble" travel as multiplier 2 or 3
 * on segment 0, which the strip names (src/ui/Scoreboard.tsx).
 */
export function targetLabel(code: number): Target {
  if (code === ANY_DOUBLE) return { segment: 0, multiplier: 2 };
  if (code === ANY_TREBLE) return { segment: 0, multiplier: 3 };
  if (code === BULL) return { segment: BULL, multiplier: 1 };
  return { segment: code, multiplier: 1 };
}
