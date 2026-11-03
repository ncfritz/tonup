// Hare and Hounds (docs/data/game-rules.md → Target-sequence games): a chase clockwise round
// the board. The hare starts on 20; the hound starts a few numbers behind. Each hit on your
// current number moves you on one. The hound wins by catching the hare (reaching the hare's
// number); the hare wins by getting all the way round back to 20.
import { type DartEvent, type PlayerRef, type Target } from '../../darts';
import { SEGMENT_ORDER } from '../../board';
import { simpleResult, simpleView } from '../simple';
import type { GameDefinition, GameVisit, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface HareHoundsSettings {
  /** How many numbers behind the hare the hound starts. */
  headStart: number;
}

export const HARE_HOUNDS_DEFAULTS: HareHoundsSettings = { headStart: 5 };

export interface HareHoundsState {
  settings: HareHoundsSettings;
  players: PlayerRef[];
  /** Steps travelled from each player's start (the hare's start is 20, step 0 of 20). */
  pos: [number, number];
  current: number;
  visits: GameVisit[];
  winner: number | null;
}

const LAP = SEGMENT_ORDER.length;
/** The number a player is on: the hare starts at 20, the hound `headStart` numbers behind. */
export function numberAt(state: HareHoundsState, p: number): number {
  const start = p === 0 ? 0 : LAP - state.settings.headStart;
  return SEGMENT_ORDER[(start + state.pos[p]!) % LAP]!;
}
/** The hound's place in the hare's terms: negative while behind the start. */
const houndTrack = (s: HareHoundsState) => s.pos[1] - s.settings.headStart;

function init(settings: HareHoundsSettings, players: PlayerRef[]): HareHoundsState {
  if (players.length !== 2)
    throw new RangeError('Hare and Hounds is for two players: the hare, then the hound');
  if (settings.headStart < 1 || settings.headStart >= LAP)
    throw new RangeError('Head start must be 1–19');
  return { settings, players, pos: [0, 0], current: 0, visits: [], winner: null };
}

function applyDart(state: HareHoundsState, dart: DartEvent): HareHoundsState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const on = numberAt(state, p);
  const step = dart.hit.segment === on ? 1 : 0;
  const pos: [number, number] = [...state.pos];
  pos[p] = pos[p]! + step;
  let visits = addDart(state.visits, p, dart, step);
  const next = { ...state, pos, visits };
  const caught = houndTrack(next) >= next.pos[0];
  if (p === 1 && caught) return { ...next, visits: endVisit(visits), winner: 1 };
  if (p === 0 && pos[0] >= LAP) return { ...next, visits: endVisit(visits), winner: 0 };
  visits = next.visits;
  const done = visits[visits.length - 1]!.done;
  return { ...next, current: done ? nextPlayer(p, 2) : p };
}

const stats = (s: HareHoundsState, id: string): StatLine[] => {
  const p = s.players.findIndex((x) => x.id === id);
  return [{ key: 'steps', value: s.pos[p as 0 | 1] ?? 0, format: 'int' }];
};

export const hareHounds: GameDefinition<HareHoundsSettings, HareHoundsState> = {
  id: 'hareHounds',
  family: 'sequence',
  defaults: HARE_HOUNDS_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.winner === null ? (s.players[s.current] ?? null) : null),
  view: (s) =>
    simpleView({
      ...s,
      over: s.winner !== null,
      rows: [0, 1].map((p) => ({
        score: s.pos[p as 0 | 1],
        note: `${p === 0 ? 'hare' : 'hound'}:${numberAt(s, p)}`,
      })),
      status:
        s.winner === null
          ? {
              kind: 'aim',
              target: { segment: numberAt(s, s.current), multiplier: 1 },
              reason: 'target',
            }
          : undefined,
    }),
  targetFor: (s): Target | null =>
    s.winner === null ? { segment: numberAt(s, s.current), multiplier: 1 } : null,
  result: (s) => simpleResult(s.players, s.winner !== null, s.winner, [...s.pos]),
  visits: (s) => s.visits,
  stats,
};
