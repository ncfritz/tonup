// Test helpers: play hits through a game, each dart by whoever is up.
import type { DartEvent, Hit, PlayerRef } from '../darts';

import type { GameDefinition } from './types';

export const dartFor = (playerId: string, seq: number, hit: Hit): DartEvent => ({
  id: `d${seq}`,
  sessionId: 's',
  playerId,
  seq,
  point: null,
  hit,
  source: 'keypad',
  precision: 'segment',
  corrected: false,
  at: seq,
});

export function playHits<S, St>(
  def: Pick<GameDefinition<S, St>, 'init' | 'applyDart' | 'currentPlayer'>,
  settings: S,
  players: PlayerRef[],
  hits: Hit[],
): St {
  let state = def.init(settings, players);
  hits.forEach((hit, seq) => {
    const p = def.currentPlayer(state);
    if (!p) throw new Error(`Game over before dart ${seq}`);
    state = def.applyDart(state, dartFor(p.id, seq, hit));
  });
  return state;
}
