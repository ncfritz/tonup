// Killer (docs/data/game-rules.md → Elimination games). Everyone has a number. Hit your own
// double to become a Killer; Killers take a life with each hit on an opponent's double. A Killer
// who hits their own double loses a life. Out at zero lives; last one standing wins.
import type { DartEvent, PlayerRef, Target } from '../../darts';
import type { Rng } from '../../bot/rng';
import type { GameDefinition, GameResult, GameVisit, ScoreboardView, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export interface KillerSettings {
  lives: number;
  /** Each player's number, by throwing order; drawn when the game is set up. */
  numbers: number[];
  /** A Killer hitting their own double loses a life (the usual rule) or nothing. */
  ownDouble: 'loseLife' | 'nothing';
}

export const KILLER_DEFAULTS: KillerSettings = { lives: 3, numbers: [], ownDouble: 'loseLife' };

/** Distinct numbers 1–20 for `n` players. */
export function drawNumbers(n: number, rng: Rng): number[] {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

export interface KillerState {
  settings: KillerSettings;
  players: PlayerRef[];
  lives: number[];
  killer: boolean[];
  current: number;
  visits: GameVisit[];
  winner: number | null;
  /** Lives taken from others, per player, for stats. */
  taken: number[];
}

function init(settings: KillerSettings, players: PlayerRef[]): KillerState {
  if (players.length < 2) throw new RangeError('Killer needs at least two players');
  if (
    settings.numbers.length !== players.length ||
    new Set(settings.numbers).size !== players.length
  ) {
    throw new RangeError('Every player needs their own number');
  }
  return {
    settings,
    players,
    lives: players.map(() => settings.lives),
    killer: players.map(() => false),
    current: 0,
    visits: [],
    winner: null,
    taken: players.map(() => 0),
  };
}

function applyDart(state: KillerState, dart: DartEvent): KillerState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const n = state.players.length;
  const lives = [...state.lives];
  const killer = [...state.killer];
  const taken = [...state.taken];
  const { hit } = dart;
  let effect = 0;
  if (hit.multiplier === 2 && hit.segment >= 1 && hit.segment <= 20) {
    const owner = state.settings.numbers.indexOf(hit.segment);
    if (owner === p) {
      if (!killer[p]) {
        killer[p] = true;
        effect = 1;
      } else if (state.settings.ownDouble === 'loseLife') {
        lives[p] = Math.max(0, lives[p]! - 1);
      }
    } else if (owner >= 0 && killer[p] && lives[owner]! > 0) {
      lives[owner] = lives[owner]! - 1;
      taken[p] = taken[p]! + 1;
      effect = 1;
    }
  }
  let visits = addDart(state.visits, p, dart, effect);
  const alive = lives.flatMap((l, i) => (l > 0 ? [i] : []));
  if (alive.length === 1) {
    visits = endVisit(visits);
    return { ...state, lives, killer, taken, visits, winner: alive[0]! };
  }
  // Knocking yourself out ends your visit.
  if (lives[p] === 0) visits = endVisit(visits);
  const done = visits[visits.length - 1]!.done;
  const current = done ? nextPlayer(p, n, (q) => lives[q]! > 0) : p;
  return { ...state, lives, killer, taken, visits, current };
}

function targetFor(state: KillerState): Target | null {
  if (state.winner !== null) return null;
  const p = state.current;
  const own = state.settings.numbers[p]!;
  if (!state.killer[p]) return { segment: own, multiplier: 2 };
  // Go after whoever is closest to going out.
  let victim = -1;
  state.lives.forEach((l, q) => {
    if (q !== p && l > 0 && (victim < 0 || l < state.lives[victim]!)) victim = q;
  });
  return { segment: state.settings.numbers[victim]!, multiplier: 2 };
}

function view(state: KillerState): ScoreboardView {
  const last = state.visits[state.visits.length - 1];
  const p = state.current;
  const target = targetFor(state);
  return {
    rows: state.players.map((pl, i) => ({
      playerId: pl.id,
      name: pl.name,
      score: state.lives[i]!,
      legs: 0,
      sets: 0,
      active: state.winner === null && i === p,
      note: `${state.settings.numbers[i]}${state.killer[i] ? ' K' : ''}`,
      out: state.lives[i] === 0,
    })),
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
        : {
            kind: 'aim',
            target: target!,
            reason: state.killer[p] ? 'killerAttack' : 'killerQualify',
          },
    set: 0,
    leg: 0,
    round: null,
  };
}

function result(state: KillerState): GameResult | null {
  if (state.winner === null) return null;
  return {
    winnerId: state.players[state.winner]!.id,
    score: Object.fromEntries(state.players.map((pl, i) => [pl.id, state.lives[i]!])),
  };
}

function stats(state: KillerState, playerId: string): StatLine[] {
  const p = state.players.findIndex((pl) => pl.id === playerId);
  const mine = state.visits.filter((v) => v.player === p);
  // Darts until the visit that made them a Killer.
  let toKiller: number | null = null;
  let count = 0;
  const own = state.settings.numbers[p];
  for (const v of mine) {
    for (const d of v.darts) {
      count++;
      if (toKiller === null && d.hit.multiplier === 2 && d.hit.segment === own) toKiller = count;
    }
  }
  return [
    { key: 'livesTaken', value: state.taken[p] ?? 0, format: 'int' },
    { key: 'livesLeft', value: state.lives[p] ?? 0, format: 'int' },
    { key: 'dartsToKiller', value: toKiller, format: 'int' },
  ];
}

export const killer: GameDefinition<KillerSettings, KillerState> = {
  id: 'killer',
  family: 'elimination',
  defaults: KILLER_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.winner === null ? (s.players[s.current] ?? null) : null),
  view,
  targetFor,
  result,
  visits: (s) => s.visits,
  stats,
};
