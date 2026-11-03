// Baseball and Bullseye Baseball (docs/data/game-rules.md → Sports games). Nine innings; inning
// N targets number N. A single scores one run, a double two, a treble three. Most runs wins;
// a tie goes to extra innings on the bull (outer one run, bull two) until someone leads after
// a full round. Bullseye Baseball: runs only count in an inning once you've hit a bull in it.
import { BULL, type DartEvent, type PlayerRef, type Target } from '../../darts';
import { bestOf, simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, nextPlayer } from '../visits';

export interface BaseballSettings {
  innings: number;
  bullseye: boolean;
}

export const BASEBALL_DEFAULTS: BaseballSettings = { innings: 9, bullseye: false };

export interface BaseballState {
  settings: BaseballSettings;
  players: PlayerRef[];
  runs: number[];
  /** Inning in play, from 1; past `innings` it's extra innings on the bull. */
  inning: number;
  current: number;
  visits: GameVisit[];
  /** Bullseye Baseball: the current visit has hit a bull. */
  bullIn: boolean;
  over: boolean;
  winner: number | null;
}

const targetOf = (s: BaseballState) => (s.inning <= s.settings.innings ? s.inning : BULL);

function init(settings: BaseballSettings, players: PlayerRef[]): BaseballState {
  if (players.length < 1) throw new RangeError('Baseball needs a player');
  if (settings.innings < 1 || settings.innings > 20) throw new RangeError('1–20 innings');
  return {
    settings,
    players,
    runs: players.map(() => 0),
    inning: 1,
    current: 0,
    visits: [],
    bullIn: false,
    over: false,
    winner: null,
  };
}

function applyDart(state: BaseballState, dart: DartEvent): BaseballState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const prev = state.visits[state.visits.length - 1];
  const fresh = !prev || prev.done || prev.player !== p;
  let bullIn = fresh ? false : state.bullIn;
  const target = targetOf(state);
  let runs = 0;
  const isBull = dart.hit.segment === BULL;
  if (state.settings.bullseye && target !== BULL && !bullIn) {
    // The bull that opens the inning scores nothing itself.
    if (isBull) bullIn = true;
  } else if (dart.hit.segment === target) {
    runs = dart.hit.multiplier;
  }
  const all = [...state.runs];
  all[p] = all[p]! + runs;
  const visits = addDart(state.visits, p, dart, runs);
  if (!visits[visits.length - 1]!.done) return { ...state, runs: all, visits, bullIn };
  const current = nextPlayer(p, state.players.length);
  if (current !== 0) return { ...state, runs: all, visits, bullIn: false, current };
  // A full round is done.
  const inning = state.inning + 1;
  if (inning > state.settings.innings) {
    const winner = bestOf(all, 'higher');
    if (winner !== null || state.players.length === 1) {
      return {
        ...state,
        runs: all,
        visits,
        bullIn: false,
        current,
        inning: state.inning,
        over: true,
        winner: winner ?? 0,
      };
    }
  }
  return { ...state, runs: all, visits, bullIn: false, current, inning };
}

function targetFor(state: BaseballState): Target | null {
  if (state.over) return null;
  const t = targetOf(state);
  if (state.settings.bullseye && t !== BULL && !state.bullIn) {
    const v = state.visits[state.visits.length - 1];
    const fresh = !v || v.done || v.player !== state.current;
    if (fresh || !state.bullIn) return { segment: BULL, multiplier: 1 };
  }
  return t === BULL ? { segment: BULL, multiplier: 2 } : { segment: t, multiplier: 3 };
}

const stats = (s: BaseballState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  const innings = Math.max(1, s.visits.filter((v) => v.player === p).length);
  return [
    { key: 'runs', value: s.runs[p] ?? 0, format: 'int' },
    { key: 'runsPerInning', value: (s.runs[p] ?? 0) / innings, format: 'one' },
  ];
};

export const baseball: GameDefinition<BaseballSettings, BaseballState> = {
  id: 'baseball',
  family: 'sports',
  defaults: BASEBALL_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view: (s) =>
    simpleView({
      ...s,
      rows: s.runs.map((score) => ({ score })),
      round: { n: s.inning, of: s.settings.innings },
      status: s.over ? undefined : { kind: 'aim', target: targetFor(s)!, reason: 'target' },
    }),
  targetFor,
  result: (s) => simpleResult(s.players, s.over, s.winner, s.runs),
  visits: (s) => s.visits,
  stats,
};
