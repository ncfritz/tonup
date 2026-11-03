// Fifty-One by Fives (docs/data/game-rules.md → X01 family): a visit scores only if its total
// divides by five, banking the total ÷ 5. A dart off the board voids the visit. First to exactly
// the target (51) wins; going over busts.
import type { DartEvent, PlayerRef, Target } from '../../darts';
import { simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface FivesSettings {
  target: number;
}

export const FIVES_DEFAULTS: FivesSettings = { target: 51 };

export interface FivesState {
  settings: FivesSettings;
  players: PlayerRef[];
  scores: number[];
  current: number;
  visits: GameVisit[];
  winner: number | null;
}

function init(settings: FivesSettings, players: PlayerRef[]): FivesState {
  if (players.length < 1) throw new RangeError('Fives needs a player');
  return { settings, players, scores: players.map(() => 0), current: 0, visits: [], winner: null };
}

function applyDart(state: FivesState, dart: DartEvent): FivesState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  let visits = addDart(state.visits, p, dart, dart.hit.score);
  const v = visits[visits.length - 1]!;
  if (!v.done) return { ...state, visits };
  // The visit is over: score it.
  const offBoard = v.darts.some((d) => d.hit.ring === 'miss');
  const sum = v.darts.reduce((n, d) => n + d.hit.score, 0);
  const banked = !offBoard && sum > 0 && sum % 5 === 0 ? sum / 5 : 0;
  const scores = [...state.scores];
  const after = scores[p]! + banked;
  const bust = after > state.settings.target;
  if (!bust) scores[p] = after;
  visits = [...visits.slice(0, -1), { ...v, total: bust ? 0 : banked, bust }];
  if (after === state.settings.target)
    return { ...state, scores, visits: endVisit(visits), winner: p };
  return { ...state, scores, visits, current: nextPlayer(p, state.players.length) };
}

function targetFor(state: FivesState): Target | null {
  if (state.winner !== null) return null;
  // 15s and 20s keep totals in fives; near the end, a single 5 or 10.
  const left = state.settings.target - state.scores[state.current]!;
  if (left <= 2) return { segment: 5, multiplier: 1 };
  return { segment: 20, multiplier: 1 };
}

const stats = (s: FivesState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  const mine = s.visits.filter((v) => v.player === p && v.done);
  const scoring = mine.filter((v) => v.total > 0).length;
  return [
    { key: 'points', value: s.scores[p] ?? 0, format: 'int' },
    { key: 'scoringVisits', value: mine.length ? scoring / mine.length : null, format: 'pct' },
  ];
};

export const fives: GameDefinition<FivesSettings, FivesState> = {
  id: 'fives',
  family: 'x01',
  defaults: FIVES_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.winner === null ? (s.players[s.current] ?? null) : null),
  view: (s) =>
    simpleView({ ...s, over: s.winner !== null, rows: s.scores.map((score) => ({ score })) }),
  targetFor,
  result: (s) => simpleResult(s.players, s.winner !== null, s.winner, s.scores),
  visits: (s) => s.visits,
  stats,
};
