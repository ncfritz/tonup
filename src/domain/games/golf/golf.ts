// Golf (docs/data/game-rules.md → Sports games). Nine or eighteen holes; hole N targets number
// N. The card varies widely; this preset scores each hole by your best dart of the visit: a
// treble is 1 stroke, a double 2, a single 3, and anything else 5 (the "stop and keep any dart"
// rule, played as keeping your best). Fewest strokes wins.
import type { DartEvent, Hit, PlayerRef, Target } from '../../darts';
import { bestOf, simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, nextPlayer } from '../visits';

export interface GolfSettings {
  holes: 9 | 18;
}

export const GOLF_DEFAULTS: GolfSettings = { holes: 9 };

/** Hole 1–18 targets 1–18. */
export const strokesFor = (hit: Hit, hole: number) =>
  hit.segment !== hole ? 5 : hit.multiplier === 3 ? 1 : hit.multiplier === 2 ? 2 : 3;

export interface GolfState {
  settings: GolfSettings;
  players: PlayerRef[];
  strokes: number[];
  hole: number;
  current: number;
  visits: GameVisit[];
  over: boolean;
  winner: number | null;
}

function init(settings: GolfSettings, players: PlayerRef[]): GolfState {
  if (players.length < 1) throw new RangeError('Golf needs a player');
  return {
    settings,
    players,
    strokes: players.map(() => 0),
    hole: 1,
    current: 0,
    visits: [],
    over: false,
    winner: null,
  };
}

function applyDart(state: GolfState, dart: DartEvent): GolfState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  let visits = addDart(state.visits, p, dart, 0);
  const v = visits[visits.length - 1]!;
  // The visit's total is its best dart so far, in strokes.
  const best = Math.min(...v.darts.map((d) => strokesFor(d.hit, state.hole)));
  visits = [...visits.slice(0, -1), { ...v, total: best }];
  if (!v.done) return { ...state, visits };
  const strokes = [...state.strokes];
  strokes[p] = strokes[p]! + best;
  const current = nextPlayer(p, state.players.length);
  const hole = current === 0 ? state.hole + 1 : state.hole;
  if (hole > state.settings.holes) {
    return { ...state, strokes, visits, current, over: true, winner: bestOf(strokes, 'lower') };
  }
  return { ...state, strokes, visits, current, hole };
}

const stats = (s: GolfState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  const holes = s.visits.filter((v) => v.player === p && v.done).length;
  return [
    { key: 'strokes', value: s.strokes[p] ?? 0, format: 'int' },
    { key: 'strokesPerHole', value: holes ? (s.strokes[p] ?? 0) / holes : null, format: 'one' },
  ];
};

export const golf: GameDefinition<GolfSettings, GolfState> = {
  id: 'golf',
  family: 'sports',
  defaults: GOLF_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view: (s) =>
    simpleView({
      ...s,
      rows: s.strokes.map((score) => ({ score })),
      round: { n: Math.min(s.hole, s.settings.holes), of: s.settings.holes },
      status: s.over
        ? undefined
        : { kind: 'aim', target: { segment: s.hole, multiplier: 3 }, reason: 'target' },
    }),
  targetFor: (s): Target | null => (s.over ? null : { segment: s.hole, multiplier: 3 }),
  result: (s) => simpleResult(s.players, s.over, s.winner, s.strokes),
  visits: (s) => s.visits,
  stats,
};
