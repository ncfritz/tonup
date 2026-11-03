// Gotcha (docs/data/game-rules.md → X01 family): count up from zero to an exact target. Land
// exactly on an opponent's total and they go back to zero; going over is a bust.
import type { DartEvent, PlayerRef, Target } from '../../darts';
import { simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface GotchaSettings {
  target: number;
  /** Finish on a double. */
  doubleOut: boolean;
}

export const GOTCHA_DEFAULTS: GotchaSettings = { target: 301, doubleOut: false };

export interface GotchaState {
  settings: GotchaSettings;
  players: PlayerRef[];
  scores: number[];
  current: number;
  visits: GameVisit[];
  winner: number | null;
  /** Times each player sent someone back to zero. */
  gotchas: number[];
  /** The current player's score when their visit began (a bust goes back to it). */
  visitStart: number;
}

function init(settings: GotchaSettings, players: PlayerRef[]): GotchaState {
  if (players.length < 2) throw new RangeError('Gotcha needs at least two players');
  return {
    settings,
    players,
    scores: players.map(() => 0),
    current: 0,
    visits: [],
    winner: null,
    gotchas: players.map(() => 0),
    visitStart: 0,
  };
}

function applyDart(state: GotchaState, dart: DartEvent): GotchaState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const { target, doubleOut } = state.settings;
  const prev = state.visits[state.visits.length - 1];
  const fresh = !prev || prev.done || prev.player !== p;
  const visitStart = fresh ? state.scores[p]! : state.visitStart;
  const scores = [...state.scores];
  const gotchas = [...state.gotchas];
  const total = scores[p]! + dart.hit.score;
  let visits = addDart(state.visits, p, dart, dart.hit.score);
  const v = visits[visits.length - 1]!;
  const bust =
    total > target ||
    (total === target && doubleOut && !dart.hit.isDouble) ||
    (doubleOut && target - total === 1);
  if (bust) {
    scores[p] = visitStart;
    visits = [...visits.slice(0, -1), { ...v, bust: true, total: 0, done: true }];
    return { ...state, scores, visits, visitStart, current: nextPlayer(p, state.players.length) };
  }
  scores[p] = total;
  if (total === target) {
    return { ...state, scores, visits: endVisit(visits), visitStart, winner: p };
  }
  // Exactly on someone else's score: they go back to zero.
  scores.forEach((s, q) => {
    if (q !== p && s === total && total > 0) {
      scores[q] = 0;
      gotchas[p] = gotchas[p]! + 1;
    }
  });
  const done = visits[visits.length - 1]!.done;
  return {
    ...state,
    scores,
    gotchas,
    visits,
    visitStart,
    current: done ? nextPlayer(p, state.players.length) : p,
  };
}

function targetFor(state: GotchaState): Target | null {
  if (state.winner !== null) return null;
  const left = state.settings.target - state.scores[state.current]!;
  if (left > 60) return { segment: 20, multiplier: 3 };
  if (state.settings.doubleOut) {
    if (left <= 40 && left % 2 === 0) return { segment: left / 2, multiplier: 2 };
    if (left === 50) return { segment: 25, multiplier: 2 };
  }
  if (left <= 20) return { segment: left, multiplier: 1 };
  if (left % 3 === 0 && left / 3 <= 20) return { segment: left / 3, multiplier: 3 };
  if (left % 2 === 0 && left / 2 <= 20) return { segment: left / 2, multiplier: 2 };
  return { segment: Math.min(20, left - 20 > 0 ? 20 : left), multiplier: 1 };
}

const stats = (s: GotchaState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  return [
    { key: 'points', value: s.scores[p] ?? 0, format: 'int' },
    { key: 'gotchas', value: s.gotchas[p] ?? 0, format: 'int' },
  ];
};

export const gotcha: GameDefinition<GotchaSettings, GotchaState> = {
  id: 'gotcha',
  family: 'x01',
  defaults: GOTCHA_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.winner === null ? (s.players[s.current] ?? null) : null),
  view: (s) =>
    simpleView({
      ...s,
      over: s.winner !== null,
      rows: s.scores.map((score) => ({ score })),
    }),
  targetFor,
  result: (s) => simpleResult(s.players, s.winner !== null, s.winner, s.scores),
  visits: (s) => s.visits,
  stats,
};
