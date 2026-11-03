// The Cricket family (docs/data/game-rules.md → Cricket family). Close each target with three
// marks; marks beyond three score while an opponent has it open.
//   Standard: the points are yours; win once everything is closed and you're level or ahead.
//   Cut-Throat: the points go to every opponent with it open; lowest wins.
//   No-Score: a race to close everything; no points.
//   Tactics: Standard on 10–20 and the bull.
//   Random: Standard on six numbers drawn when the game is set up, plus the bull.
//   Mickey Mouse: Standard on 20 down to 12, any double, any treble and the bull (one preset of
//   a game whose rules vary by region).
import { BULL, type DartEvent, type Hit, type PlayerRef, type Target } from '../../darts';
import type { GameDefinition, GameResult, GameVisit, ScoreboardView, StatLine } from '../types';
import { addDart, checkPlayer, endVisit, nextPlayer } from '../visits';

export type CricketVariant =
  'standard' | 'cutThroat' | 'noScore' | 'tactics' | 'random' | 'mickeyMouse';

export interface CricketSettings {
  variant: CricketVariant;
  /** After this many rounds the best points total wins (league play uses 20); null for no limit. */
  roundLimit: number | null;
  /** Random Cricket's six numbers, drawn when the game is set up. */
  numbers?: number[];
}

export const CRICKET_DEFAULTS: CricketSettings = { variant: 'standard', roundLimit: 20 };

/** Target codes: 1–20, 25 for the bull, and Mickey Mouse's "any double" and "any treble". */
export const ANY_DOUBLE = -2;
export const ANY_TREBLE = -3;

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, BULL] as const;

export function cricketTargets(s: CricketSettings): number[] {
  switch (s.variant) {
    case 'tactics':
      return [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, BULL];
    case 'random': {
      const n = s.numbers ?? [];
      if (n.length !== 6 || new Set(n).size !== 6 || n.some((x) => x < 1 || x > 20)) {
        throw new RangeError('Random Cricket needs six different numbers');
      }
      return [...[...n].sort((a, b) => b - a), BULL];
    }
    case 'mickeyMouse':
      return [20, 19, 18, 17, 16, 15, 14, 13, 12, ANY_DOUBLE, ANY_TREBLE, BULL];
    default:
      return [...CRICKET_NUMBERS];
  }
}

const scoring = (s: CricketSettings): 'own' | 'cut' | 'none' =>
  s.variant === 'cutThroat' ? 'cut' : s.variant === 'noScore' ? 'none' : 'own';

export interface CricketState {
  settings: CricketSettings;
  players: PlayerRef[];
  targets: number[];
  /** marks[player][target index], uncapped (extra marks are kept for MPR). */
  marks: number[][];
  points: number[];
  current: number;
  visits: GameVisit[];
  winner: number | null;
  /** Rounds where every player has had a visit. */
  rounds: number;
}

/**
 * Which target a dart marks, how many marks and what each extra mark is worth. A dart on a
 * number counts there; in Mickey Mouse a double or treble on a number that isn't a target (or
 * that you've closed) counts toward "any double" or "any treble" instead.
 */
function markOf(
  state: CricketState,
  p: number,
  hit: Hit,
): { i: number; marks: number; value: number } | null {
  if (hit.ring === 'miss') return null;
  const t = state.targets;
  const i = t.indexOf(hit.segment);
  const open = (k: number) => k >= 0 && state.marks[p]![k]! < 3;
  if (
    i >= 0 &&
    (open(i) || !t.includes(ANY_DOUBLE) || hit.multiplier === 1 || hit.segment === BULL)
  ) {
    return { i, marks: hit.multiplier, value: hit.segment === BULL ? 25 : hit.segment };
  }
  const any =
    hit.multiplier === 2
      ? t.indexOf(ANY_DOUBLE)
      : hit.multiplier === 3
        ? t.indexOf(ANY_TREBLE)
        : -1;
  if (any >= 0) return { i: any, marks: 1, value: hit.score };
  if (i >= 0) return { i, marks: hit.multiplier, value: hit.segment };
  return null;
}

function init(settings: CricketSettings, players: PlayerRef[]): CricketState {
  if (players.length < 1) throw new RangeError('Cricket needs at least one player');
  const targets = cricketTargets(settings);
  return {
    settings,
    players,
    targets,
    marks: players.map(() => targets.map(() => 0)),
    points: players.map(() => 0),
    current: 0,
    visits: [],
    winner: null,
    rounds: 0,
  };
}

const closed = (state: CricketState, p: number, i: number) => state.marks[p]![i]! >= 3;
const allClosed = (state: CricketState, p: number) =>
  state.targets.every((_, i) => closed(state, p, i));

function winnerNow(state: CricketState): number | null {
  const mode = scoring(state.settings);
  for (let p = 0; p < state.players.length; p++) {
    if (!allClosed(state, p)) continue;
    if (mode === 'none') return p;
    const mine = state.points[p]!;
    const others = state.points.filter((_, q) => q !== p);
    if (others.every((o) => (mode === 'cut' ? mine <= o : mine >= o))) return p;
  }
  return null;
}

/** At the round limit: best points (lowest in Cut-Throat), then most marks, then throw order. */
function winnerAtLimit(state: CricketState): number {
  const cut = scoring(state.settings) === 'cut';
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
  const m = markOf(state, p, dart.hit);
  if (m) {
    const before = marks[p]![m.i]!;
    const extra = Math.max(0, before + m.marks - 3) - Math.max(0, before - 3);
    marks[p]![m.i] = before + m.marks;
    scored = m.marks;
    const mode = scoring(state.settings);
    if (extra > 0 && mode !== 'none') {
      const open = state.players.map((_, q) => q !== p && marks[q]![m.i]! < 3);
      if (mode === 'cut') {
        open.forEach((o, q) => o && (points[q] = points[q]! + extra * m.value));
      } else if (open.some(Boolean)) {
        points[p] = points[p]! + extra * m.value;
      }
    }
  }
  let visits = addDart(state.visits, p, dart, scored);
  let next: CricketState = { ...state, marks, points, visits };
  const winner = winnerNow(next);
  if (winner !== null) return { ...next, visits: endVisit(visits), winner };
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

/** Where to aim at a target code. */
function aimAt(code: number): Target {
  if (code === BULL) return { segment: BULL, multiplier: 2 };
  if (code === ANY_DOUBLE) return { segment: 20, multiplier: 2 };
  if (code === ANY_TREBLE) return { segment: 20, multiplier: 3 };
  return { segment: code, multiplier: 3 };
}

/** The bot's aim: catch up on points where it can, otherwise close the highest open target. */
function targetFor(state: CricketState): Target | null {
  if (state.winner !== null) return null;
  const p = state.current;
  const mode = scoring(state.settings);
  const others = state.points.filter((_, q) => q !== p);
  const behind = mode === 'own' && others.length > 0 && state.points[p]! < Math.max(...others);
  const scorable = (i: number) =>
    closed(state, p, i) && state.players.some((_, q) => q !== p && !closed(state, q, i));
  if (behind) {
    const i = state.targets.findIndex((_, k) => scorable(k));
    if (i >= 0) return aimAt(state.targets[i]!);
  }
  const open = state.targets.findIndex((_, i) => !closed(state, p, i));
  if (open >= 0) return aimAt(state.targets[open]!);
  const i = state.targets.findIndex((_, k) => scorable(k));
  return aimAt(state.targets[i >= 0 ? i : 0]!);
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
      numbers: [...state.targets],
      marks: state.marks.map((m) => m.map((x) => Math.min(3, x))),
      dead: state.targets.map((_, i) => state.players.every((_, q) => closed(state, q, i))),
      points: scoring(state.settings) !== 'none',
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
