// Shared pieces for drills: the one-player scoreboard, darts thrown and the result shape.
import type { PlayerRef } from '../darts';
import type { GameResult, GameVisit, ScoreboardView } from '../games/types';

export const dartsThrown = (visits: readonly GameVisit[]) =>
  visits.reduce((n, v) => n + v.darts.length, 0);

export function onePlayer(players: PlayerRef[], name: string): PlayerRef {
  if (players.length !== 1) throw new RangeError(`${name} is for one player`);
  return players[0]!;
}

/** A one-row scoreboard for a drill. */
export function soloView(
  player: PlayerRef,
  visits: readonly GameVisit[],
  score: number,
  over: boolean,
  round: { n: number; of: number } | null = null,
): ScoreboardView {
  const last = visits[visits.length - 1];
  return {
    rows: [{ playerId: player.id, name: player.name, score, legs: 0, sets: 0, active: !over }],
    visit: last
      ? {
          playerId: player.id,
          darts: last.darts.map((d) => d.hit),
          total: last.total,
          bust: last.bust,
        }
      : { playerId: player.id, darts: [], total: 0, bust: false },
    status: over ? { kind: 'matchWon', playerId: player.id } : { kind: 'playing' },
    set: 0,
    leg: 0,
    round,
  };
}

export const soloResult = (player: PlayerRef, over: boolean, score: number): GameResult | null =>
  over ? { winnerId: player.id, score: { [player.id]: score } } : null;
