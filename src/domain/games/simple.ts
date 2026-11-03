// Shared pieces for the simpler games: a view built from rows, and single-winner results.
import type { DartEvent, PlayerRef } from '../darts';

import type {
  GameResult,
  GameVisit,
  ScoreboardRow,
  ScoreboardStatus,
  ScoreboardView,
} from './types';

export function simpleView(args: {
  players: PlayerRef[];
  visits: GameVisit[];
  current: number;
  over: boolean;
  winner: number | null;
  rows: Omit<ScoreboardRow, 'playerId' | 'name' | 'legs' | 'sets' | 'active'>[];
  status?: ScoreboardStatus;
  round?: { n: number; of: number } | null;
  detail?: ScoreboardView['detail'];
}): ScoreboardView {
  const { players, visits, current, over, winner } = args;
  const last = visits[visits.length - 1];
  return {
    rows: players.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      legs: 0,
      sets: 0,
      active: !over && i === current,
      ...args.rows[i]!,
    })),
    visit: last
      ? {
          playerId: players[last.player]!.id,
          darts: last.darts.map((d) => d.hit),
          total: last.total,
          bust: last.bust,
        }
      : { playerId: players[current]!.id, darts: [], total: 0, bust: false },
    status: over
      ? winner !== null
        ? { kind: 'matchWon', playerId: players[winner]!.id }
        : { kind: 'playing' }
      : (args.status ?? { kind: 'playing' }),
    set: 0,
    leg: 0,
    round: args.round ?? null,
    detail: args.detail,
  };
}

export function simpleResult(
  players: PlayerRef[],
  over: boolean,
  winner: number | null,
  score: number[],
): GameResult | null {
  if (!over) return null;
  return {
    winnerId: winner === null ? null : players[winner]!.id,
    score: Object.fromEntries(players.map((p, i) => [p.id, score[i]!])),
  };
}

/** The player with the single best score, or null for a tie. */
export function bestOf(scores: number[], better: 'higher' | 'lower'): number | null {
  const best = better === 'higher' ? Math.max(...scores) : Math.min(...scores);
  const at = scores.flatMap((s, i) => (s === best ? [i] : []));
  return at.length === 1 ? at[0]! : null;
}

export const dartsOf = (visits: GameVisit[], p: number) =>
  visits.filter((v) => v.player === p).reduce((n, v) => n + v.darts.length, 0);

export type { DartEvent };
