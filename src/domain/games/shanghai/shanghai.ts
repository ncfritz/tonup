// Shanghai (docs/data/game-rules.md → Target-sequence games): round 1 is the 1s, round 2 the 2s,
// and so on. Only the round's number scores, at its value times the ring. A single, double and
// treble of it in one visit is a Shanghai and wins at once.
import type { DartEvent, PlayerRef, Target } from '../../darts';
import type { GameDefinition, GameResult, GameVisit, ScoreboardView, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface ShanghaiSettings {
  /** 7 or 20, usually. */
  rounds: number;
  instantWin: boolean;
}

export const SHANGHAI_DEFAULTS: ShanghaiSettings = { rounds: 7, instantWin: true };

export interface ShanghaiState {
  settings: ShanghaiSettings;
  players: PlayerRef[];
  points: number[];
  /** Round in play, from 1. */
  round: number;
  current: number;
  visits: GameVisit[];
  /** Null with `over` true is a draw. */
  winner: number | null;
  over: boolean;
  /** Who threw a Shanghai, if anyone. */
  shanghai: number | null;
}

function init(settings: ShanghaiSettings, players: PlayerRef[]): ShanghaiState {
  if (players.length < 1) throw new RangeError('Shanghai needs at least one player');
  if (settings.rounds < 1 || settings.rounds > 20) throw new RangeError('Shanghai has 1–20 rounds');
  return {
    settings,
    players,
    points: players.map(() => 0),
    round: 1,
    current: 0,
    visits: [],
    winner: null,
    over: false,
    shanghai: null,
  };
}

function applyDart(state: ShanghaiState, dart: DartEvent): ShanghaiState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const hits = dart.hit.segment === state.round ? dart.hit.multiplier : 0;
  const scored = hits * state.round;
  const points = [...state.points];
  points[p] = points[p]! + scored;
  let visits = addDart(state.visits, p, dart, scored);
  const visit = visits[visits.length - 1]!;
  const rings = new Set(
    visit.darts.filter((d) => d.hit.segment === state.round).map((d) => d.hit.multiplier),
  );
  if (state.settings.instantWin && rings.has(1) && rings.has(2) && rings.has(3)) {
    visits = endVisit(visits);
    return { ...state, points, visits, winner: p, over: true, shanghai: p };
  }
  if (!visit.done) return { ...state, points, visits };
  const n = state.players.length;
  const current = nextPlayer(p, n);
  const round = current === 0 ? state.round + 1 : state.round;
  if (round > state.settings.rounds) {
    const best = Math.max(...points);
    const leaders = points.flatMap((x, i) => (x === best ? [i] : []));
    return {
      ...state,
      points,
      visits,
      current,
      round: state.round,
      winner: leaders.length === 1 ? leaders[0]! : null,
      over: true,
    };
  }
  return { ...state, points, visits, current, round };
}

function targetFor(state: ShanghaiState): Target | null {
  return state.over ? null : { segment: state.round, multiplier: 3 };
}

function view(state: ShanghaiState): ScoreboardView {
  const last = state.visits[state.visits.length - 1];
  const p = state.current;
  return {
    rows: state.players.map((pl, i) => ({
      playerId: pl.id,
      name: pl.name,
      score: state.points[i]!,
      legs: 0,
      sets: 0,
      active: !state.over && i === p,
    })),
    visit: last
      ? {
          playerId: state.players[last.player]!.id,
          darts: last.darts.map((d) => d.hit),
          total: last.total,
          bust: false,
        }
      : { playerId: state.players[p]!.id, darts: [], total: 0, bust: false },
    status: state.over
      ? state.winner !== null
        ? { kind: 'matchWon', playerId: state.players[state.winner]!.id }
        : { kind: 'playing' }
      : { kind: 'aim', target: { segment: state.round, multiplier: 1 }, reason: 'shanghai' },
    set: 0,
    leg: 0,
    round: { n: state.round, of: state.settings.rounds },
  };
}

function result(state: ShanghaiState): GameResult | null {
  if (!state.over) return null;
  return {
    winnerId: state.winner === null ? null : state.players[state.winner]!.id,
    score: Object.fromEntries(state.players.map((pl, i) => [pl.id, state.points[i]!])),
  };
}

function stats(state: ShanghaiState, playerId: string): StatLine[] {
  const p = state.players.findIndex((pl) => pl.id === playerId);
  const mine = state.visits.filter((v) => v.player === p);
  const darts = mine.reduce((n, v) => n + v.darts.length, 0);
  // A dart counts as a hit when it lands on that visit's number.
  const hits = mine.reduce(
    (n, v, i) => n + v.darts.filter((d) => d.hit.segment === roundOf(state, v, i)).length,
    0,
  );
  return [
    { key: 'points', value: state.points[p] ?? 0, format: 'int' },
    { key: 'hitRate', value: darts ? hits / darts : null, format: 'pct' },
    { key: 'shanghais', value: state.shanghai === p ? 1 : 0, format: 'int' },
  ];
}

/** Each player has one visit per round, so a player's i-th visit is round i + 1. */
const roundOf = (_state: ShanghaiState, _v: GameVisit, i: number) => i + 1;

export const shanghai: GameDefinition<ShanghaiSettings, ShanghaiState> = {
  id: 'shanghai',
  family: 'sequence',
  defaults: SHANGHAI_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view,
  targetFor,
  result,
  visits: (s) => s.visits,
  stats,
};
