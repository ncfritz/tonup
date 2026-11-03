// Football (docs/data/game-rules.md → Sports games): hit the bull (either ring) to win
// possession; while you have it, each double is a goal. A visit without a goal loses the ball.
// First to the goal target (10) wins.
import { BULL, type DartEvent, type PlayerRef, type Target } from '../../darts';
import { simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface FootballSettings {
  goals: number;
}

export const FOOTBALL_DEFAULTS: FootballSettings = { goals: 10 };

export interface FootballState {
  settings: FootballSettings;
  players: PlayerRef[];
  goals: number[];
  /** Who has the ball, if anyone. */
  ball: number | null;
  current: number;
  visits: GameVisit[];
  winner: number | null;
}

function init(settings: FootballSettings, players: PlayerRef[]): FootballState {
  if (players.length < 2) throw new RangeError('Football needs two players or more');
  return {
    settings,
    players,
    goals: players.map(() => 0),
    ball: null,
    current: 0,
    visits: [],
    winner: null,
  };
}

function applyDart(state: FootballState, dart: DartEvent): FootballState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  let ball = state.ball;
  const goals = [...state.goals];
  let scored = 0;
  if (ball !== p) {
    if (dart.hit.segment === BULL) ball = p;
  } else if (dart.hit.isDouble && dart.hit.segment !== BULL) {
    goals[p] = goals[p]! + 1;
    scored = 1;
  }
  let visits = addDart(state.visits, p, dart, scored);
  if (goals[p]! >= state.settings.goals) {
    return { ...state, goals, ball, visits: endVisit(visits), winner: p };
  }
  const v = visits[visits.length - 1]!;
  if (!v.done) return { ...state, goals, ball, visits };
  // A visit with the ball and no goal gives it away.
  if (ball === p && v.total === 0) ball = null;
  visits = [...visits];
  return { ...state, goals, ball, visits, current: nextPlayer(p, state.players.length) };
}

function targetFor(state: FootballState): Target | null {
  if (state.winner !== null) return null;
  return state.ball === state.current
    ? { segment: 20, multiplier: 2 }
    : { segment: BULL, multiplier: 1 };
}

const stats = (s: FootballState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  return [{ key: 'goals', value: s.goals[p] ?? 0, format: 'int' }];
};

export const football: GameDefinition<FootballSettings, FootballState> = {
  id: 'football',
  family: 'sports',
  defaults: FOOTBALL_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.winner === null ? (s.players[s.current] ?? null) : null),
  view: (s) =>
    simpleView({
      ...s,
      over: s.winner !== null,
      rows: s.goals.map((score, i) => ({ score, note: s.ball === i ? 'ball' : undefined })),
      status:
        s.winner === null
          ? {
              kind: 'aim',
              target: targetFor(s)!,
              reason: s.ball === s.current ? 'goal' : 'possession',
            }
          : undefined,
    }),
  targetFor,
  result: (s) => simpleResult(s.players, s.winner !== null, s.winner, s.goals),
  visits: (s) => s.visits,
  stats,
};
