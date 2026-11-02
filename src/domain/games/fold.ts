import type { DartEvent, PlayerRef } from '../darts';

import type { GameDefinition } from './types';

/**
 * Rebuilds a game from its darts (ADR 0006). Darts are applied in `seq` order; `upTo` stops
 * after that many darts, which is how replay steps through a match.
 */
export function fold<S, St>(
  def: GameDefinition<S, St>,
  settings: S,
  players: PlayerRef[],
  darts: readonly DartEvent[],
  upTo = Infinity,
): St {
  const ordered = [...darts].sort((a, b) => a.seq - b.seq);
  let state = def.init(settings, players);
  for (let i = 0; i < ordered.length && i < upTo; i++) {
    state = def.applyDart(state, ordered[i]!);
  }
  return state;
}
