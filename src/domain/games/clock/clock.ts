// Around the Clock (docs/data/game-rules.md → Target-sequence games): hit 1 to 20 in order,
// then the bull. First to finish wins.
import { BULL, type DartEvent, type Hit, type PlayerRef, type Target } from '../../darts';
import type { GameDefinition, GameResult, GameVisit, ScoreboardView, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface ClockSettings {
  /** What counts as hitting the number. */
  ring: 'any' | 'doubles' | 'trebles';
  /** A double moves you on two numbers and a treble three (with `ring: 'any'`). */
  skip: boolean;
  /** Finish on the bull after 20. */
  bull: boolean;
}

export const CLOCK_DEFAULTS: ClockSettings = { ring: 'any', skip: false, bull: true };

export interface ClockState {
  settings: ClockSettings;
  players: PlayerRef[];
  /** Index into the sequence of each player's next target. */
  next: number[];
  current: number;
  visits: GameVisit[];
  winner: number | null;
}

export const clockSequence = (s: ClockSettings): number[] => [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  ...(s.bull ? [BULL] : []),
];

function counts(s: ClockSettings, hit: Hit, target: number): boolean {
  if (hit.segment !== target) return false;
  if (target === BULL) return s.ring === 'any' || hit.multiplier === 2;
  if (s.ring === 'doubles') return hit.multiplier === 2;
  if (s.ring === 'trebles') return hit.multiplier === 3;
  return hit.multiplier >= 1;
}

function init(settings: ClockSettings, players: PlayerRef[]): ClockState {
  if (players.length < 1) throw new RangeError('Around the Clock needs at least one player');
  return { settings, players, next: players.map(() => 0), current: 0, visits: [], winner: null };
}

function applyDart(state: ClockState, dart: DartEvent): ClockState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const seq = clockSequence(state.settings);
  const at = state.next[p]!;
  const target = seq[at]!;
  let step = 0;
  if (counts(state.settings, dart.hit, target)) {
    step =
      state.settings.skip && state.settings.ring === 'any' && target !== BULL
        ? dart.hit.multiplier
        : 1;
  }
  const next = [...state.next];
  next[p] = Math.min(seq.length, at + step);
  // Skipping can't jump past 20 onto the bull: the bull must be hit on its own.
  if (state.settings.bull && at < 20 && next[p]! > 20) next[p] = 20;
  let visits = addDart(state.visits, p, dart, step ? 1 : 0);
  if (next[p] === seq.length) {
    visits = endVisit(visits);
    return { ...state, next, visits, winner: p };
  }
  const done = visits[visits.length - 1]!.done;
  return { ...state, next, visits, current: done ? nextPlayer(p, state.players.length) : p };
}

function targetFor(state: ClockState): Target | null {
  if (state.winner !== null) return null;
  const target = clockSequence(state.settings)[state.next[state.current]!]!;
  if (target === BULL) return { segment: BULL, multiplier: state.settings.ring === 'any' ? 1 : 2 };
  const m = state.settings.ring === 'doubles' ? 2 : state.settings.ring === 'trebles' ? 3 : 1;
  return { segment: target, multiplier: m };
}

function view(state: ClockState): ScoreboardView {
  const seq = clockSequence(state.settings);
  const last = state.visits[state.visits.length - 1];
  const p = state.current;
  const target = targetFor(state);
  return {
    rows: state.players.map((pl, i) => {
      const t = seq[state.next[i]!];
      return {
        playerId: pl.id,
        name: pl.name,
        // How many numbers are done.
        score: state.next[i]!,
        legs: 0,
        sets: 0,
        active: state.winner === null && i === p,
        note: t === undefined ? 'done' : t === BULL ? 'bull' : String(t),
      };
    }),
    visit: last
      ? {
          playerId: state.players[last.player]!.id,
          darts: last.darts.map((d) => d.hit),
          total: last.total,
          bust: false,
        }
      : { playerId: state.players[p]!.id, darts: [], total: 0, bust: false },
    status:
      state.winner !== null
        ? { kind: 'matchWon', playerId: state.players[state.winner]!.id }
        : { kind: 'aim', target: target!, reason: 'clock' },
    set: 0,
    leg: 0,
    round: null,
  };
}

function result(state: ClockState): GameResult | null {
  if (state.winner === null) return null;
  return {
    winnerId: state.players[state.winner]!.id,
    score: Object.fromEntries(state.players.map((pl, i) => [pl.id, state.next[i]!])),
  };
}

function stats(state: ClockState, playerId: string): StatLine[] {
  const p = state.players.findIndex((pl) => pl.id === playerId);
  const mine = state.visits.filter((v) => v.player === p);
  const darts = mine.reduce((n, v) => n + v.darts.length, 0);
  const hits = mine.reduce((n, v) => n + v.total, 0);
  return [
    { key: 'darts', value: darts, format: 'int' },
    { key: 'hitRate', value: darts ? hits / darts : null, format: 'pct' },
    { key: 'reached', value: state.next[p] ?? 0, format: 'int' },
  ];
}

export const clock: GameDefinition<ClockSettings, ClockState> = {
  id: 'clock',
  family: 'sequence',
  defaults: CLOCK_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.winner === null ? (s.players[s.current] ?? null) : null),
  view,
  targetFor,
  result,
  visits: (s) => s.visits,
  stats,
};
