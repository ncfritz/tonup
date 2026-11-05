// What a match summary charts, per game (docs/design/stats.md → Per game): worked out from the
// stored darts of one finished match.
import type { GameId, ReplayLeg } from '@/domain/games';
import { replayLegs } from '@/domain/games';
import {
  closingGrid,
  doubleLadder,
  footballFigures,
  killerTally,
  scamInnings,
  ticTacToeFigures,
  roundTotals,
  targetRates,
  visitBands,
  worm,
  type ClosingGrid,
  type FootballFigures,
  type KillerTally,
  type ScamInning,
  type TicTacToeFigures,
  type TargetRate,
  type VisitBand,
} from '@/domain/stats';

import { YOU_ID } from '../game/lineup';
import type { LoadedGame } from '../game/session';

export interface WormLeg {
  /** series[p]: player p's score at the start and after each visit. */
  series: number[][];
  /** The x position (visit) the leg was won on, and who won it. */
  won: { player: number; at: number; visit: number } | null;
}

export interface LegRow {
  leg: number;
  winner: number | null;
  /** Darts the winner used. */
  darts: number;
  /** The winner's average in the leg. */
  average: number;
  /** The checkout and its last dart's label. */
  checkout: number | null;
  first: number;
}

export interface SummaryCharts {
  /** You, or the first player when you aren't in the match. */
  you: number;
  worm?: { kind: 'remaining' | 'points' | 'lives' | 'position'; legs: WormLeg[] };
  visits?: Record<VisitBand, number>[];
  doubles?: TargetRate[];
  legs?: LegRow[];
  closing?: ClosingGrid;
  rounds?: { kind: 'marks' | 'points' | 'halved'; totals: number[][] };
  /** Rates per number for you: darts per number (clock), hit rate (Shanghai). */
  wheel?: { kind: 'darts' | 'rate'; rates: TargetRate[] };
  table?: { kind: 'golf' | 'baseball'; totals: number[][]; sums: number[] };
  killer?: KillerTally;
  football?: FootballFigures;
  ticTacToe?: TicTacToeFigures;
  scam?: ScamInning[];
}

const WORM: Partial<Record<GameId, NonNullable<SummaryCharts['worm']>['kind']>> = {
  x01: 'remaining',
  gotcha: 'points',
  fives: 'points',
  countUp: 'points',
  killer: 'lives',
  hareHounds: 'position',
  football: 'points',
  scam: 'points',
};

const ROUNDS: Partial<Record<GameId, NonNullable<SummaryCharts['rounds']>['kind']>> = {
  cricket: 'marks',
  shanghai: 'points',
  halveIt: 'halved',
};

/** What the worm plots for a game, or null for games without one. */
export const wormKind = (typeId: string) => WORM[typeId as GameId] ?? null;

export function wormLegs(game: LoadedGame, legs: ReplayLeg[], kind: string): WormLeg[] {
  const { def, session } = game;
  const startRows = def.view(def.init(session.settings, session.players)).rows;
  const pick =
    kind === 'lives'
      ? (r: { lives?: number; score: number }) => r.lives ?? r.score
      : (r: { score: number }) => r.score;
  const start = startRows.map((r) => pick(r));
  return legs.map((l) => {
    const last = l.frames.length - 1;
    const end = l.frames[last];
    return {
      series: worm(start, l.frames, pick),
      won: end?.endsLeg
        ? {
            player: end.player,
            at: last + 1,
            visit: l.frames.filter((f) => f.player === end.player).length,
          }
        : null,
    };
  });
}

function x01LegRows(legs: ReplayLeg[]): LegRow[] {
  return legs.map((l) => {
    const end = l.frames[l.frames.length - 1];
    const winner = end?.endsLeg ? end.player : null;
    const mine = winner === null ? [] : l.frames.filter((f) => f.player === winner);
    const darts = mine.reduce((n, f) => n + f.darts.length, 0);
    const points = mine.reduce((n, f) => n + (f.bust ? 0 : f.total), 0);
    return {
      leg: l.leg,
      winner,
      darts,
      average: darts ? (points / darts) * 3 : 0,
      checkout: winner === null ? null : end!.total,
      first: l.frames[0]?.player ?? 0,
    };
  });
}

/** The charts for a finished game's summary. */
export function summaryCharts(game: LoadedGame): SummaryCharts {
  const { def, session, darts } = game;
  const typeId = session.typeId as GameId;
  const players = session.players;
  const found = players.findIndex((p) => p.id === YOU_ID);
  const you = found >= 0 ? found : 0;
  const youId = players[you]!.id;
  const out: SummaryCharts = { you };
  if (session.kind !== 'game') return out;
  const legs = replayLegs(def, session.settings, players, darts);
  const frames = legs.flatMap((l) => l.frames);
  const mine = darts.filter((d) => d.playerId === youId);

  const wormKind = WORM[typeId];
  if (wormKind) out.worm = { kind: wormKind, legs: wormLegs(game, legs, wormKind) };

  if (typeId === 'x01' || typeId === 'countUp') {
    out.visits = players.map((_, p) =>
      visitBands(frames.filter((f) => f.player === p).map((f) => (f.bust ? 0 : f.total))),
    );
  }
  if (typeId === 'x01') {
    out.doubles = doubleLadder(mine);
    out.legs = x01LegRows(legs);
  }
  const grid = closingGrid(def, session.settings, players, darts);
  if (grid) out.closing = grid;

  const roundKind = ROUNDS[typeId];
  if (roundKind) out.rounds = { kind: roundKind, totals: roundTotals(frames, players.length) };

  if (typeId === 'clock') out.wheel = { kind: 'darts', rates: targetRates(mine) };
  if (typeId === 'shanghai') out.wheel = { kind: 'rate', rates: targetRates(mine) };

  if (typeId === 'golf' || typeId === 'baseball') {
    const totals = roundTotals(frames, players.length);
    out.table = {
      kind: typeId,
      totals,
      sums: totals.map((t) => t.reduce((a, b) => a + b, 0)),
    };
  }
  if (typeId === 'killer') out.killer = killerTally(def, session.settings, players, darts);
  if (typeId === 'football') {
    out.football = footballFigures(session.settings as never, players, darts);
  }
  if (typeId === 'ticTacToe') {
    out.ticTacToe = ticTacToeFigures(session.settings as never, players, darts);
  }
  if (typeId === 'scam') out.scam = scamInnings(players, darts);
  return out;
}
