// Cricket, Standard and Cut-Throat (docs/data/game-rules.md → Cricket family). Close 20–15 and
// the bull with three marks each; marks beyond three score while an opponent has the number
// open. Standard: the points are yours, and you win once everything is closed and you're level
// or ahead. Cut-Throat: the points go to every opponent with it open, and lowest wins.
import { BULL, type DartEvent, type PlayerRef, type Target } from '../../darts';
import type { GameDefinition, GameResult, GameVisit, ScoreboardView, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export type CricketVariant = 'standard' | 'cutThroat';

export interface CricketSettings {
  variant: CricketVariant;
  /** After this many rounds the best points total wins (league play uses 20); null for no limit. */
  roundLimit: number | null;
}

export const CRICKET_DEFAULTS: CricketSettings = { variant: 'standard', roundLimit: 20 };

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, BULL] as const;

export interface CricketState {
  settings: CricketSettings;
  players: PlayerRef[];
  /** marks[player][number index], uncapped (extra marks are kept for MPR). */
  marks: number[][];
  points: number[];
  current: number;
  visits: GameVisit[];
  winner: number | null;
  /** Rounds where every player has had a visit. */
  rounds: number;
}

const marksFor = (dart: DartEvent) => {
  const i = CRICKET_NUMBERS.indexOf(dart.hit.segment as (typeof CRICKET_NUMBERS)[number]);
  return i < 0 ? null : { i, marks: dart.hit.multiplier };
};

function init(settings: CricketSettings, players: PlayerRef[]): CricketState {
  if (players.length < 1) throw new RangeError('Cricket needs at least one player');
  return {
    settings,
    players,
    marks: players.map(() => CRICKET_NUMBERS.map(() => 0)),
    points: players.map(() => 0),
    current: 0,
    visits: [],
    winner: null,
    rounds: 0,
  };
}

const closed = (state: CricketState, p: number, i: number) => state.marks[p]![i]! >= 3;
const allClosed = (state: CricketState, p: number) =>
  CRICKET_NUMBERS.every((_, i) => closed(state, p, i));

function winnerNow(state: CricketState): number | null {
  const cut = state.settings.variant === 'cutThroat';
  for (let p = 0; p < state.players.length; p++) {
    if (!allClosed(state, p)) continue;
    const mine = state.points[p]!;
    const others = state.points.filter((_, q) => q !== p);
    if (others.every((o) => (cut ? mine <= o : mine >= o))) return p;
  }
  return null;
}

/** At the round limit: best points (lowest in Cut-Throat), then most marks, then throw order. */
function winnerAtLimit(state: CricketState): number {
  const cut = state.settings.variant === 'cutThroat';
  const total = (p: number) => state.marks[p]!.reduce((s, m) => s + Math.min(3, m), 0);
  let best = 0;
  for (let p = 1; p < state.players.length; p++) {
    const a = state.points[p]!;
    const b = state.points[best]!;
    if ((cut ? a < b : a > b) || (a === b && total(p) > total(best))) best = p;
  }
  return best;
}

function applyDart(state: CricketState, dart: DartEvent): CricketState {
  if (state.winner !== null) throw new Error('The game is over');
  const p = state.current;
  checkPlayer(state.players[p]?.id, dart);
  const n = state.players.length;
  const marks = state.marks.map((m) => [...m]);
  const points = [...state.points];
  let scored = 0;
  const m = marksFor(dart);
  if (m) {
    const value = CRICKET_NUMBERS[m.i]!;
    const before = marks[p]![m.i]!;
    const extra = Math.max(0, before + m.marks - 3) - Math.max(0, before - 3);
    marks[p]![m.i] = before + m.marks;
    scored = m.marks;
    if (extra > 0) {
      const open = state.players.map((_, q) => q !== p && marks[q]![m.i]! < 3);
      if (state.settings.variant === 'cutThroat') {
        open.forEach((o, q) => o && (points[q] = points[q]! + extra * value));
      } else if (open.some(Boolean)) {
        points[p] = points[p]! + extra * value;
      }
    }
  }
  let visits = addDart(state.visits, p, dart, scored);
  let next: CricketState = { ...state, marks, points, visits };
  const winner = winnerNow(next);
  if (winner !== null) {
    return { ...next, visits: endVisit(visits), winner };
  }
  if (visits[visits.length - 1]!.done) {
    const current = nextPlayer(p, n);
    const rounds = current === 0 ? state.rounds + 1 : state.rounds;
    next = { ...next, current, rounds };
    const limit = state.settings.roundLimit;
    if (limit !== null && rounds >= limit) {
      visits = endVisit(visits);
      return { ...next, visits, winner: winnerAtLimit(next) };
    }
  }
  return next;
}

function currentPlayer(state: CricketState) {
  return state.winner === null ? (state.players[state.current] ?? null) : null;
}

/** The bot's aim: catch up on points where it can, otherwise close the highest open number. */
function targetFor(state: CricketState): Target | null {
  if (state.winner !== null) return null;
  const p = state.current;
  const cut = state.settings.variant === 'cutThroat';
  const aim = (i: number): Target =>
    CRICKET_NUMBERS[i] === BULL
      ? { segment: BULL, multiplier: 2 }
      : { segment: CRICKET_NUMBERS[i]!, multiplier: 3 };
  const behind = cut
    ? state.points[p]! > Math.min(...state.points.filter((_, q) => q !== p), Infinity)
    : state.points[p]! < Math.max(...state.points.filter((_, q) => q !== p), -Infinity);
  if (behind && !cut) {
    const scoring = CRICKET_NUMBERS.findIndex(
      (_, i) =>
        closed(state, p, i) && state.players.some((_, q) => q !== p && !closed(state, q, i)),
    );
    if (scoring >= 0) return aim(scoring);
  }
  const open = CRICKET_NUMBERS.findIndex((_, i) => !closed(state, p, i));
  if (open >= 0) return aim(open);
  // Everything closed but behind: score on a number an opponent still has open.
  const scoring = CRICKET_NUMBERS.findIndex((_, i) =>
    state.players.some((_, q) => q !== p && !closed(state, q, i)),
  );
  return aim(scoring >= 0 ? scoring : 0);
}

function view(state: CricketState): ScoreboardView {
  const last = state.visits[state.visits.length - 1];
  const p = state.current;
  return {
    rows: state.players.map((pl, i) => ({
      playerId: pl.id,
      name: pl.name,
      score: state.points[i]!,
      legs: 0,
      sets: 0,
      active: state.winner === null && i === p,
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
        : { kind: 'playing' },
    set: 0,
    leg: 0,
    round: state.settings.roundLimit
      ? { n: Math.min(state.rounds + 1, state.settings.roundLimit), of: state.settings.roundLimit }
      : null,
    detail: {
      kind: 'cricket',
      numbers: [...CRICKET_NUMBERS],
      marks: state.marks.map((m) => m.map((x) => Math.min(3, x))),
      dead: CRICKET_NUMBERS.map((_, i) => state.players.every((_, q) => closed(state, q, i))),
    },
  };
}

function result(state: CricketState): GameResult | null {
  if (state.winner === null) return null;
  return {
    winnerId: state.players[state.winner]!.id,
    score: Object.fromEntries(state.players.map((pl, i) => [pl.id, state.points[i]!])),
  };
}

function stats(state: CricketState, playerId: string): StatLine[] {
  const p = state.players.findIndex((pl) => pl.id === playerId);
  const mine = state.visits.filter((v) => v.player === p);
  const darts = mine.reduce((n, v) => n + v.darts.length, 0);
  const marks = mine.reduce((n, v) => n + v.total, 0);
  return [
    { key: 'mpr', value: darts ? (marks / darts) * 3 : 0, format: 'one' },
    { key: 'points', value: state.points[p] ?? 0, format: 'int' },
    { key: 'marks', value: marks, format: 'int' },
    { key: 'darts', value: darts, format: 'int' },
  ];
}

export const cricket: GameDefinition<CricketSettings, CricketState> = {
  id: 'cricket',
  family: 'cricket',
  defaults: CRICKET_DEFAULTS,
  init,
  applyDart,
  currentPlayer,
  view,
  targetFor,
  result,
  visits: (s) => s.visits,
  stats,
};
