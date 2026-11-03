// A bot's next dart: a ghost throws with its fitted scatter, other bots by their level.
import { ghostThrow, parseGhost } from '@/domain/analysis';
import { botThrow, type Rng } from '@/domain/bot';
import type { Hit, PlayerRef, Point, Target } from '@/domain/darts';

export function throwFor<State>(
  game: { targetFor(state: State): Target | null },
  state: State,
  player: PlayerRef,
  rng: Rng,
): { point: Point; hit: Hit; intended: Target } | null {
  const ghost = parseGhost(player.id);
  if (ghost) {
    const intended = game.targetFor(state);
    if (!intended) return null;
    return { ...ghostThrow(intended, ghost, rng), intended };
  }
  return botThrow(game, state, player.botLevel ?? 3, rng);
}
