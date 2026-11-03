// Tic-Tac-Toe (docs/data/game-rules.md → Sports games): nine targets on a 3×3 grid with the
// bull in the centre, laid out where they sit on the board. Hit a target to claim its square;
// three in a row wins. A full grid with no line is a draw.
import { BULL, type DartEvent, type PlayerRef, type Target } from '../../darts';
import { simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface TicTacToeSettings {
  /** What claims a square: any hit on it, or only a double or treble. */
  ring: 'any' | 'doubles' | 'trebles';
}

export const TIC_TAC_TOE_DEFAULTS: TicTacToeSettings = { ring: 'any' };

/** Row by row, roughly where each number sits on the board. */
export const GRID = [12, 20, 1, 11, BULL, 6, 16, 3, 2];
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export interface TicTacToeState {
  settings: TicTacToeSettings;
  players: PlayerRef[];
  owner: (number | null)[];
  current: number;
  visits: GameVisit[];
  over: boolean;
  winner: number | null;
}

function init(settings: TicTacToeSettings, players: PlayerRef[]): TicTacToeState {
  if (players.length !== 2) throw new RangeError('Tic-Tac-Toe is for two players');
  return {
    settings,
    players,
    owner: GRID.map(() => null),
    current: 0,
    visits: [],
    over: false,
    winner: null,
  };
}

function claims(s: TicTacToeSettings, mult: number) {
  return s.ring === 'any' || (s.ring === 'doubles' ? mult === 2 : mult === 3);
}

function applyDart(state: TicTacToeState, dart: DartEvent): TicTacToeState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const i = GRID.indexOf(dart.hit.segment);
  const owner = [...state.owner];
  let claimed = 0;
  // The bull can't be trebled, so it only needs a hit (or the bull itself for doubles).
  const ok =
    i >= 0 &&
    owner[i] === null &&
    (GRID[i] === BULL
      ? state.settings.ring !== 'doubles' || dart.hit.multiplier === 2
      : claims(state.settings, dart.hit.multiplier));
  if (ok) {
    owner[i] = p;
    claimed = 1;
  }
  let visits = addDart(state.visits, p, dart, claimed);
  if (LINES.some((l) => l.every((c) => owner[c] === p))) {
    return { ...state, owner, visits: endVisit(visits), over: true, winner: p };
  }
  if (owner.every((o) => o !== null)) {
    return { ...state, owner, visits: endVisit(visits), over: true, winner: null };
  }
  const done = visits[visits.length - 1]!.done;
  visits = [...visits];
  return { ...state, owner, visits, current: done ? nextPlayer(p, 2) : p };
}

/** The bot takes a winning square, blocks one, or goes for the centre, then corners. */
function targetFor(state: TicTacToeState): Target | null {
  if (state.over) return null;
  const me = state.current;
  const them = 1 - me;
  const free = (i: number) => state.owner[i] === null;
  const finish = (who: number) =>
    LINES.flatMap((l) => {
      const mine = l.filter((c) => state.owner[c] === who).length;
      const open = l.filter(free);
      return mine === 2 && open.length === 1 ? open : [];
    })[0];
  const pick = finish(me) ?? finish(them) ?? [4, 0, 2, 6, 8, 1, 3, 5, 7].find(free);
  if (pick === undefined) return null;
  const n = GRID[pick]!;
  const m = state.settings.ring === 'doubles' ? 2 : state.settings.ring === 'trebles' ? 3 : 1;
  return n === BULL
    ? { segment: BULL, multiplier: state.settings.ring === 'doubles' ? 2 : 1 }
    : { segment: n, multiplier: m };
}

const stats = (s: TicTacToeState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  return [{ key: 'squares', value: s.owner.filter((o) => o === p).length, format: 'int' }];
};

export const ticTacToe: GameDefinition<TicTacToeSettings, TicTacToeState> = {
  id: 'ticTacToe',
  family: 'sports',
  defaults: TIC_TAC_TOE_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view: (s) =>
    simpleView({
      ...s,
      rows: [0, 1].map((p) => ({
        score: s.owner.filter((o) => o === p).length,
        note: p === 0 ? 'x' : 'o',
      })),
      detail: { kind: 'grid', cells: [...GRID], owner: [...s.owner] },
    }),
  targetFor,
  result: (s) =>
    simpleResult(
      s.players,
      s.over,
      s.winner,
      [0, 1].map((p) => s.owner.filter((o) => o === p).length),
    ),
  visits: (s) => s.visits,
  stats,
};
