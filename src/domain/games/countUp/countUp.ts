// Count Up as a game (docs/data/game-rules.md → Target-sequence games): a set number of visits,
// everything counts, highest total wins.
import type { DartEvent, PlayerRef, Target } from '../../darts';
import { bestOf, simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, nextPlayer } from '../visits';

export interface CountUpGameSettings {
  visits: number;
}

export const COUNT_UP_GAME_DEFAULTS: CountUpGameSettings = { visits: 8 };

export interface CountUpGameState {
  settings: CountUpGameSettings;
  players: PlayerRef[];
  scores: number[];
  round: number;
  current: number;
  visits: GameVisit[];
  over: boolean;
  winner: number | null;
}

function init(settings: CountUpGameSettings, players: PlayerRef[]): CountUpGameState {
  if (players.length < 1) throw new RangeError('Count Up needs a player');
  return {
    settings,
    players,
    scores: players.map(() => 0),
    round: 1,
    current: 0,
    visits: [],
    over: false,
    winner: null,
  };
}

function applyDart(state: CountUpGameState, dart: DartEvent): CountUpGameState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const scores = [...state.scores];
  scores[p] = scores[p]! + dart.hit.score;
  const visits = addDart(state.visits, p, dart, dart.hit.score);
  if (!visits[visits.length - 1]!.done) return { ...state, scores, visits };
  const current = nextPlayer(p, state.players.length);
  const round = current === 0 ? state.round + 1 : state.round;
  if (round > state.settings.visits) {
    return { ...state, scores, visits, current, over: true, winner: bestOf(scores, 'higher') };
  }
  return { ...state, scores, visits, current, round };
}

const targetFor = (s: CountUpGameState): Target | null =>
  s.over ? null : { segment: 20, multiplier: 3 };

const stats = (s: CountUpGameState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  const darts = s.visits.filter((v) => v.player === p).reduce((n, v) => n + v.darts.length, 0);
  return [
    { key: 'points', value: s.scores[p] ?? 0, format: 'int' },
    { key: 'average', value: darts ? ((s.scores[p] ?? 0) / darts) * 3 : 0, format: 'one' },
  ];
};

export const countUpGame: GameDefinition<CountUpGameSettings, CountUpGameState> = {
  id: 'countUp',
  family: 'sequence',
  defaults: COUNT_UP_GAME_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view: (s) =>
    simpleView({
      ...s,
      rows: s.scores.map((score) => ({ score })),
      round: { n: Math.min(s.round, s.settings.visits), of: s.settings.visits },
    }),
  targetFor,
  result: (s) => simpleResult(s.players, s.over, s.winner, s.scores),
  visits: (s) => s.visits,
  stats,
};
