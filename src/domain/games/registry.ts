import { clock } from './clock';
import { cricket } from './cricket';
import { killer } from './killer';
import { shanghai } from './shanghai';
import type { GameDefinition, GameId } from './types';
import { x01 } from './x01';

/** Every game in the app. The rest of the 26 join in M11. */
export const games = { x01, cricket, clock, shanghai, killer } as const;

/** A game by id with its settings and state types erased, for screens that handle any game. */
export function gameFor(id: string): GameDefinition<unknown, unknown> {
  const def = (games as Record<string, unknown>)[id];
  if (!def) throw new Error(`Unknown game ${id}`);
  return def as GameDefinition<unknown, unknown>;
}

export const GAME_IDS = Object.keys(games) as GameId[];
