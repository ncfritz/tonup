// Figures for the games whose charts need more than visits and scores (docs/design/stats.md →
// Per game): Killer's knock-outs, Football's possession, Tic-Tac-Toe's squares, Scam's innings.
// Each folds the game dart by dart, so it can't disagree with what happened (ADR 0006).
import { BULL, type DartEvent, type PlayerRef } from '../darts';
import { football, type FootballSettings, type FootballState } from '../games/football';
import type { GameDefinition } from '../games';
import { scam, SCAM_TARGETS, type ScamState } from '../games/scam';
import { ticTacToe, type TicTacToeSettings, type TicTacToeState } from '../games/ticTacToe';

const ordered = (darts: readonly DartEvent[]) => [...darts].sort((a, b) => a.seq - b.seq);

export interface KillerTally {
  /** taken[a][b]: lives player a took from player b (a === b: lives lost to your own double). */
  taken: number[][];
  /** For each player knocked out: who took the last life (themselves, for an own double), and the round. */
  out: ({ by: number; round: number } | null)[];
}

/** Who took whose lives in Killer (any variant), read from the scoreboard's lives after each dart. */
export function killerTally(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): KillerTally {
  const n = players.length;
  const taken = players.map(() => players.map(() => 0));
  const out: KillerTally['out'] = players.map(() => null);
  let state = def.init(settings, players);
  const lives = (s: unknown) => def.view(s).rows.map((r) => r.lives ?? r.score);
  let before = lives(state);
  for (const d of ordered(darts)) {
    const thrower = players.findIndex((p) => p.id === d.playerId);
    state = def.applyDart(state, d);
    const after = lives(state);
    const round = Math.floor((def.visits(state).length - 1) / n) + 1;
    after.forEach((l, v) => {
      const lost = before[v]! - l;
      if (lost > 0 && thrower >= 0) {
        taken[thrower]![v]! += lost;
        if (l === 0) out[v] = { by: thrower, round };
      }
    });
    before = after;
  }
  return { taken, out };
}

export interface FootballFigures {
  /** Per player: darts thrown at the bull before winning the ball, averaged per possession won. */
  dartsToWin: (number | null)[];
  /** Per player: darts thrown with the ball, per goal scored. */
  dartsPerGoal: (number | null)[];
  possessions: number[];
  goals: number[];
}

export function footballFigures(
  settings: FootballSettings,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): FootballFigures {
  const n = players.length;
  const chasing = Array.from({ length: n }, () => 0);
  const withBall = Array.from({ length: n }, () => 0);
  const wins = Array.from({ length: n }, () => 0);
  let state: FootballState = football.init(settings, players);
  for (const d of ordered(darts)) {
    const p = state.current;
    const had = state.ball === p;
    state = football.applyDart(state, d);
    if (had) withBall[p]!++;
    else {
      chasing[p]!++;
      if (d.hit.segment === BULL) wins[p]!++;
    }
  }
  return {
    dartsToWin: chasing.map((c, p) => (wins[p] ? c / wins[p]! : null)),
    dartsPerGoal: withBall.map((c, p) => (state.goals[p] ? c / state.goals[p]! : null)),
    possessions: wins,
    goals: state.goals,
  };
}

export interface SquareClaim {
  /** The square, 0–8, row by row. */
  cell: number;
  /** Its target (25 for the bull). */
  target: number;
  player: number;
  /** 1 for the first square claimed in the game. */
  order: number;
}

export interface TicTacToeFigures {
  claims: SquareClaim[];
  /** The board's targets, row by row. */
  cells: number[];
  /** Per player: darts thrown per square claimed. */
  dartsPerSquare: (number | null)[];
}

export function ticTacToeFigures(
  settings: TicTacToeSettings,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): TicTacToeFigures {
  let state: TicTacToeState = ticTacToe.init(settings, players);
  const thrown = players.map(() => 0);
  const claims: SquareClaim[] = [];
  for (const d of ordered(darts)) {
    const p = state.current;
    const was = state.owner;
    state = ticTacToe.applyDart(state, d);
    thrown[p]!++;
    state.owner.forEach((o, cell) => {
      if (o !== null && was[cell] === null) {
        claims.push({ cell, target: 0, player: o, order: claims.length + 1 });
      }
    });
  }
  const cells = (ticTacToe.view(state).detail as { cells: number[] } | undefined)?.cells ?? [];
  for (const c of claims) c.target = cells[c.cell] ?? 0;
  return {
    claims,
    cells,
    dartsPerSquare: thrown.map((t, p) => {
      const won = claims.filter((c) => c.player === p).length;
      return won ? t / won : null;
    }),
  };
}

export interface ScamInning {
  stopper: number;
  scorer: number;
  /** The stopper's visit (from 1) that closed each of SCAM_TARGETS, or null if still open. */
  closedOn: (number | null)[];
  stopperVisits: number;
  /** Numbers the stopper closed in each of their visits. */
  stoppedPerVisit: number[];
  /** What the scorer made in the inning. */
  points: number;
}

export function scamInnings(players: PlayerRef[], darts: readonly DartEvent[]): ScamInning[] {
  let state: ScamState = scam.init({}, players);
  const innings: ScamInning[] = [];
  const start = (inning: 0 | 1): ScamInning => ({
    stopper: inning === 0 ? 1 : 0,
    scorer: inning,
    closedOn: SCAM_TARGETS.map(() => null),
    stopperVisits: 0,
    stoppedPerVisit: [],
    points: 0,
  });
  let cur = start(0);
  innings.push(cur);
  let lastVisits = 0;
  for (const d of ordered(darts)) {
    const p = state.current;
    const inning = state.inning;
    const open = state.open;
    const scoresBefore = state.scores[cur.scorer]!;
    state = scam.applyDart(state, d);
    const visits = state.visits.length;
    // A new visit by the stopper starts with this dart.
    if (p === cur.stopper && visits !== lastVisits) {
      cur.stopperVisits++;
      cur.stoppedPerVisit.push(0);
    }
    lastVisits = visits;
    if (p === cur.stopper) {
      const i = SCAM_TARGETS.indexOf(d.hit.segment);
      if (i >= 0 && open[i] && cur.closedOn[i] === null) {
        cur.closedOn[i] = cur.stopperVisits;
        cur.stoppedPerVisit[cur.stoppedPerVisit.length - 1]!++;
      }
    } else {
      cur.points += state.scores[cur.scorer]! - scoresBefore;
    }
    if (state.inning !== inning && !state.over) {
      cur = start(state.inning);
      innings.push(cur);
    }
  }
  return innings;
}
