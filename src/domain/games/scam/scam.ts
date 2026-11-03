// Scam (docs/data/game-rules.md → Elimination games). Rules vary; this preset: two players,
// two innings. In each inning one player is the stopper and the other the scorer, taking visits
// in turn, stopper first. The stopper's darts close the numbers they land on (1–20 and the
// bull); the scorer scores the value of darts on numbers still open. The inning ends when
// every number is closed; then the roles swap. Higher score as scorer wins.
import { BULL, type DartEvent, type PlayerRef, type Target } from '../../darts';
import { bestOf, simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, endVisit } from '../visits';

export type ScamSettings = Record<string, never>;

export const SCAM_TARGETS = [...Array.from({ length: 20 }, (_, i) => 20 - i), BULL];

export interface ScamState {
  players: PlayerRef[];
  /** 0: player 0 scores and player 1 stops; 1: the other way round. */
  inning: 0 | 1;
  open: boolean[];
  scores: [number, number];
  current: number;
  visits: GameVisit[];
  over: boolean;
  winner: number | null;
}

const stopperOf = (inning: 0 | 1) => (inning === 0 ? 1 : 0);
const scorerOf = (inning: 0 | 1) => inning;

function init(_s: ScamSettings, players: PlayerRef[]): ScamState {
  if (players.length !== 2) throw new RangeError('Scam is for two players');
  return {
    players,
    inning: 0,
    open: SCAM_TARGETS.map(() => true),
    scores: [0, 0],
    current: stopperOf(0),
    visits: [],
    over: false,
    winner: null,
  };
}

function applyDart(state: ScamState, dart: DartEvent): ScamState {
  if (state.over) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const i = SCAM_TARGETS.indexOf(dart.hit.segment);
  const open = [...state.open];
  const scores: [number, number] = [...state.scores];
  let points = 0;
  if (p === stopperOf(state.inning)) {
    if (i >= 0 && open[i]) {
      open[i] = false;
      points = 1;
    }
  } else if (i >= 0 && open[i]) {
    points = dart.hit.score;
    scores[p] = scores[p]! + points;
  }
  let visits = addDart(state.visits, p, dart, points);
  if (open.every((o) => !o)) {
    visits = endVisit(visits);
    if (state.inning === 1) {
      return { ...state, open, scores, visits, over: true, winner: bestOf(scores, 'higher') };
    }
    return {
      ...state,
      open: SCAM_TARGETS.map(() => true),
      scores,
      visits,
      inning: 1,
      current: stopperOf(1),
    };
  }
  const done = visits[visits.length - 1]!.done;
  return { ...state, open, scores, visits, current: done ? 1 - p : p };
}

function targetFor(state: ScamState): Target | null {
  if (state.over) return null;
  const firstOpen = SCAM_TARGETS.find((_, i) => state.open[i]);
  if (firstOpen === undefined) return null;
  // The stopper takes the big numbers away first; the scorer goes after them.
  return state.current === stopperOf(state.inning)
    ? { segment: firstOpen, multiplier: firstOpen === BULL ? 1 : 1 }
    : { segment: firstOpen, multiplier: firstOpen === BULL ? 2 : 3 };
}

const stats = (s: ScamState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  return [{ key: 'points', value: s.scores[p as 0 | 1] ?? 0, format: 'int' }];
};

export const scam: GameDefinition<ScamSettings, ScamState> = {
  id: 'scam',
  family: 'elimination',
  defaults: {},
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : (s.players[s.current] ?? null)),
  view: (s) =>
    simpleView({
      ...s,
      rows: [0, 1].map((p) => ({
        score: s.scores[p as 0 | 1],
        note: p === scorerOf(s.inning) ? 'scorer' : 'stopper',
      })),
      round: { n: s.inning + 1, of: 2 },
      status: s.over
        ? undefined
        : {
            kind: 'aim',
            target: targetFor(s) ?? { segment: 20, multiplier: 1 },
            reason: s.current === stopperOf(s.inning) ? 'stopper' : 'scorer',
          },
    }),
  targetFor,
  result: (s) => simpleResult(s.players, s.over, s.winner, [...s.scores]),
  visits: (s) => s.visits,
  stats,
};
