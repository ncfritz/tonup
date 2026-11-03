import { baseball } from './baseball';
import { clock } from './clock';
import { countUpGame } from './countUp';
import { cricket } from './cricket';
import { fives } from './fives';
import { football } from './football';
import { golf } from './golf';
import { gotcha } from './gotcha';
import { halveIt } from './halveIt';
import { hareHounds } from './hareHounds';
import { killer } from './killer';
import { scam } from './scam';
import { shanghai } from './shanghai';
import { ticTacToe } from './ticTacToe';
import type { GameDefinition, GameId } from './types';
import { x01 } from './x01';

/**
 * Every game engine. The 26 games in the rules library are these engines and their variants
 * (src/content/rules.ts says which).
 */
export const games = {
  x01,
  cricket,
  clock,
  shanghai,
  killer,
  gotcha,
  fives,
  countUp: countUpGame,
  halveIt,
  hareHounds,
  scam,
  baseball,
  golf,
  football,
  ticTacToe,
} as const satisfies Record<GameId, unknown>;

/** A game by id with its settings and state types erased, for screens that handle any game. */
export function gameFor(id: string): GameDefinition<unknown, unknown> {
  const def = (games as Record<string, unknown>)[id];
  if (!def) throw new Error(`Unknown game ${id}`);
  return def as GameDefinition<unknown, unknown>;
}

export const GAME_IDS = Object.keys(games) as GameId[];
