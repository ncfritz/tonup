// X01: 501, 301, 701… counted down to exactly zero (docs/data/game-rules.md → X01 family).
// Pure functions over darts (ADR 0006). Missed darts are recorded as misses, so "Next" with
// darts left in a visit records misses for them; a bust ends the visit on its own.
import { checkoutRoute, setupTarget, type OutRule } from '../../checkout';
import type { DartEvent, Hit, PlayerRef, Target } from '../../darts';
import type { GameDefinition, GameResult, ScoreboardStatus, ScoreboardView } from '../types';

export type InRule = 'straight' | 'double' | 'master';

export interface X01Settings {
  startScore: number;
  in: InRule;
  out: OutRule;
  /** Legs needed to win a set (or the match when `sets` is 1): first to N. */
  legs: number;
  /** Sets needed to win the match: first to N; 1 means a legs-only match. */
  sets: number;
  /** Favourite double for checkout suggestions. */
  preferredDouble?: number;
}

export const X01_DEFAULTS: X01Settings = {
  startScore: 501,
  in: 'straight',
  out: 'double',
  legs: 3,
  sets: 1,
};

/** A finished or in-progress visit, kept for the scoreboard, stats and replay. */
export interface X01Visit {
  player: number;
  set: number;
  /** Leg number within the match, from 0. */
  leg: number;
  darts: DartEvent[];
  /** Remaining before each dart, for checkout stats. */
  before: number[];
  /** Whether the player was opened before each dart (double/master in). */
  openedBefore: boolean[];
  scored: number;
  bust: boolean;
  checkout: boolean;
  done: boolean;
}

export interface X01State {
  settings: X01Settings;
  players: PlayerRef[];
  remaining: number[];
  opened: boolean[];
  /** Legs won in the current set. */
  legs: number[];
  sets: number[];
  set: number;
  /** Leg within the current set, from 0. */
  legInSet: number;
  /** Leg within the match, from 0. */
  leg: number;
  current: number;
  visits: X01Visit[];
  legWinner: number | null;
  winner: number | null;
}

const inOk = (rule: InRule, h: Hit) =>
  rule === 'straight' || (rule === 'double' ? h.isDouble : h.isDouble || h.multiplier === 3);

const outOk = (rule: OutRule, h: Hit) =>
  rule === 'straight' || (rule === 'double' ? h.isDouble : h.isDouble || h.multiplier === 3);

/** The lowest score left that can still be finished (1 can't be on a double or master out). */
const minLeft = (rule: OutRule) => (rule === 'straight' ? 1 : 2);

/** Who throws first in a leg: alternate sets, then alternate legs within the set. */
const starterFor = (set: number, legInSet: number, n: number) => (set + legInSet) % n;

function newLeg(state: X01State): X01State {
  const n = state.players.length;
  return {
    ...state,
    remaining: state.players.map(() => state.settings.startScore),
    opened: state.players.map(() => state.settings.in === 'straight'),
    current: starterFor(state.set, state.legInSet, n),
  };
}

function init(settings: X01Settings, players: PlayerRef[]): X01State {
  if (players.length < 1) throw new RangeError('X01 needs at least one player');
  if (settings.legs < 1 || settings.sets < 1) throw new RangeError('Legs and sets start at 1');
  return newLeg({
    settings,
    players,
    remaining: [],
    opened: [],
    legs: players.map(() => 0),
    sets: players.map(() => 0),
    set: 0,
    legInSet: 0,
    leg: 0,
    current: 0,
    visits: [],
    legWinner: null,
    winner: null,
  });
}

function openVisit(state: X01State): X01Visit {
  const last = state.visits[state.visits.length - 1];
  if (last && !last.done) return last;
  return {
    player: state.current,
    set: state.set,
    leg: state.leg,
    darts: [],
    before: [],
    openedBefore: [],
    scored: 0,
    bust: false,
    checkout: false,
    done: false,
  };
}

function applyDart(state: X01State, dart: DartEvent): X01State {
  if (state.winner !== null) throw new Error('The match is over');
  const p = state.current;
  if (state.players[p]?.id !== dart.playerId) {
    throw new Error(`Expected a dart from ${state.players[p]?.id}, got ${dart.playerId}`);
  }
  const { settings: s } = state;
  const prev = openVisit(state);
  const visitStart = prev.darts.length ? prev.before[0]! : state.remaining[p]!;
  const openedAtStart = prev.darts.length ? prev.openedBefore[0]! : state.opened[p]!;
  const before = state.remaining[p]!;
  const wasOpened = state.opened[p]!;
  const opens = wasOpened || inOk(s.in, dart.hit);
  const score = opens ? dart.hit.score : 0;
  const left = before - score;
  const bust = left < 0 || (left === 0 ? !outOk(s.out, dart.hit) : left < minLeft(s.out));
  const checkout = !bust && left === 0;

  const visit: X01Visit = {
    ...prev,
    darts: [...prev.darts, dart],
    before: [...prev.before, before],
    openedBefore: [...prev.openedBefore, wasOpened],
    scored: bust ? 0 : visitStart - left,
    bust,
    checkout,
  };
  visit.done = bust || checkout || visit.darts.length === 3;

  const visits = prev.darts.length
    ? [...state.visits.slice(0, -1), visit]
    : [...state.visits, visit];
  const remaining = [...state.remaining];
  const opened = [...state.opened];
  remaining[p] = bust ? visitStart : left;
  opened[p] = bust ? openedAtStart : opens;

  let next: X01State = { ...state, visits, remaining, opened, legWinner: null };
  if (checkout) return winLeg(next, p);
  if (visit.done) next = { ...next, current: (p + 1) % state.players.length };
  return next;
}

function winLeg(state: X01State, p: number): X01State {
  const { settings: s } = state;
  const legs = [...state.legs];
  const sets = [...state.sets];
  legs[p] = legs[p]! + 1;
  let set = state.set;
  let legInSet = state.legInSet + 1;
  if (legs[p] === s.legs) {
    sets[p] = sets[p]! + 1;
    if (sets[p] === s.sets) {
      return { ...state, legs, sets, legWinner: p, winner: p };
    }
    set += 1;
    legInSet = 0;
    legs.fill(0);
  }
  return newLeg({ ...state, legs, sets, set, legInSet, leg: state.leg + 1, legWinner: p });
}

function currentPlayer(state: X01State): PlayerRef | null {
  return state.winner === null ? (state.players[state.current] ?? null) : null;
}

function dartsLeftInVisit(state: X01State): number {
  const last = state.visits[state.visits.length - 1];
  return last && !last.done ? 3 - last.darts.length : 3;
}

function targetFor(state: X01State): Target | null {
  if (state.winner !== null) return null;
  const { settings: s } = state;
  const p = state.current;
  if (!state.opened[p]) return { segment: 20, multiplier: 2 };
  const left = state.remaining[p]!;
  const route = checkoutRoute(left, dartsLeftInVisit(state), s.out, s.preferredDouble);
  return route?.[0] ?? setupTarget(left, s.out, s.preferredDouble);
}

function view(state: X01State): ScoreboardView {
  const { settings: s } = state;
  const last = state.visits[state.visits.length - 1];
  const p = state.current;
  let status: ScoreboardStatus;
  if (state.winner !== null) {
    status = { kind: 'matchWon', playerId: state.players[state.winner]!.id };
  } else if (state.legWinner !== null && last?.checkout) {
    status = { kind: 'legWon', playerId: state.players[state.legWinner]!.id };
  } else if (last?.bust && last.done) {
    status = { kind: 'bust' };
  } else if (!state.opened[p]) {
    status = { kind: 'notOpened' };
  } else {
    const route = checkoutRoute(
      state.remaining[p]!,
      dartsLeftInVisit(state),
      s.out,
      s.preferredDouble,
    );
    status = route ? { kind: 'checkout', route } : { kind: 'noFinish' };
  }
  // The visit in progress, or the one just finished until the next dart is thrown.
  const shown = last ?? null;
  return {
    rows: state.players.map((pl, i) => ({
      playerId: pl.id,
      name: pl.name,
      score: state.remaining[i]!,
      legs: state.legs[i]!,
      sets: state.sets[i]!,
      active: state.winner === null && i === p,
    })),
    visit: shown
      ? {
          playerId: state.players[shown.player]!.id,
          darts: shown.darts.map((d) => d.hit),
          total: shown.bust ? 0 : shown.scored,
          bust: shown.bust,
        }
      : { playerId: state.players[p]!.id, darts: [], total: 0, bust: false },
    status,
    set: state.set,
    leg: state.legInSet,
  };
}

function result(state: X01State): GameResult | null {
  if (state.winner === null) return null;
  const counts = state.settings.sets > 1 ? state.sets : state.legs;
  return {
    winnerId: state.players[state.winner]!.id,
    score: Object.fromEntries(state.players.map((pl, i) => [pl.id, counts[i]!])),
  };
}

export const x01: GameDefinition<X01Settings, X01State> = {
  id: 'x01',
  family: 'x01',
  defaults: X01_DEFAULTS,
  init,
  applyDart,
  currentPlayer,
  view,
  targetFor,
  result,
};
