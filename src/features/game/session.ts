// Playing a stored game (M2): every dart goes to the database as it's thrown, and the game is
// rebuilt from its darts on load, undo and edit (ADR 0006).
import { randomUUID } from 'expo-crypto';

import type { DartEvent, DartSource, Hit, PlayerRef, Point, Target } from '@/domain/darts';
import { fold, foldValid, games, type GameResult } from '@/domain/games';
import type { X01Settings, X01State } from '@/domain/games/x01';
import { x01Stats, type X01Stats } from '@/domain/stats';
import {
  appendDart,
  createSession,
  getSession,
  loadDarts,
  readCachedStat,
  replaceDartsFrom,
  setResult,
  writeCachedStat,
  type SessionRecord,
} from '@/services/db/sessionsRepo';

export interface LoadedGame {
  session: SessionRecord;
  darts: DartEvent[];
  state: X01State;
}

/** What the scoring screen knows about a dart; the session fills in the rest. */
export interface DartInput {
  hit: Hit;
  point: Point | null;
  source: DartSource;
  intended?: Target;
}

const now = () => Date.now();

export function startX01(settings: X01Settings, players: PlayerRef[]): string {
  const id = randomUUID();
  createSession({ id, kind: 'game', typeId: 'x01', settings, players, startedAt: now() });
  return id;
}

export function loadGame(sessionId: string): LoadedGame {
  const session = getSession(sessionId);
  if (!session) throw new Error(`No session ${sessionId}`);
  if (session.typeId !== 'x01') throw new Error(`Unsupported game ${session.typeId}`);
  const darts = loadDarts(sessionId);
  const state = fold(games.x01, session.settings as X01Settings, session.players, darts);
  return { session, darts, state };
}

/** Records the next dart for whoever is up and returns the new state. */
export function recordDart(game: LoadedGame, input: DartInput): LoadedGame {
  const player = games.x01.currentPlayer(game.state);
  if (!player) throw new Error('The game is over');
  const dart: DartEvent = {
    id: randomUUID(),
    sessionId: game.session.id,
    playerId: player.id,
    seq: game.darts.length ? game.darts[game.darts.length - 1]!.seq + 1 : 0,
    point: input.point,
    hit: input.hit,
    intended: input.intended,
    source: input.source,
    precision: input.source === 'keypad' ? 'segment' : 'exact',
    corrected: false,
    at: now(),
  };
  // Apply first, so a dart the rules reject is never stored.
  const state = games.x01.applyDart(game.state, dart);
  appendDart(dart);
  const next = { ...game, darts: [...game.darts, dart], state };
  return syncResult(next);
}

/** Removes the last dart. */
export function undoLastDart(game: LoadedGame): LoadedGame {
  const last = game.darts[game.darts.length - 1];
  if (!last) return game;
  replaceDartsFrom(game.session.id, last.seq);
  const darts = game.darts.slice(0, -1);
  const state = fold(games.x01, game.session.settings as X01Settings, game.session.players, darts);
  return syncResult({ ...game, darts, state });
}

/**
 * Changes one dart. If the change alters whose turn it is (say it makes a bust), darts after
 * it that no longer fit are removed; `dropped` says how many, so the UI can warn first with
 * `previewEdit`.
 */
export function editDart(
  game: LoadedGame,
  seq: number,
  change: { hit: Hit; point: Point | null; source: DartSource },
): { game: LoadedGame; dropped: number } {
  const { darts, kept, dropped } = edited(game, seq, change);
  replaceDartsFrom(
    game.session.id,
    seq,
    darts.slice(
      darts.findIndex((d) => d.seq === seq),
      kept,
    ),
  );
  const valid = darts.slice(0, kept);
  const state = fold(games.x01, game.session.settings as X01Settings, game.session.players, valid);
  return { game: syncResult({ ...game, darts: valid, state }), dropped };
}

/** How many later darts an edit would remove, without changing anything. */
export function previewEdit(
  game: LoadedGame,
  seq: number,
  change: { hit: Hit; point: Point | null; source: DartSource },
): number {
  return edited(game, seq, change).dropped;
}

function edited(
  game: LoadedGame,
  seq: number,
  change: { hit: Hit; point: Point | null; source: DartSource },
) {
  const darts = game.darts.map((d) =>
    d.seq === seq
      ? {
          ...d,
          hit: change.hit,
          point: change.point,
          source: change.source,
          precision: change.source === 'keypad' ? ('segment' as const) : ('exact' as const),
          corrected: true,
        }
      : d,
  );
  if (!darts.some((d) => d.seq === seq)) throw new Error(`No dart ${seq}`);
  const { applied } = foldValid(
    games.x01,
    game.session.settings as X01Settings,
    game.session.players,
    darts,
  );
  return { darts, kept: applied, dropped: darts.length - applied };
}

/** Keeps the session's stored result in step with the folded state (undo can reopen a game). */
function syncResult(game: LoadedGame): LoadedGame {
  const result: GameResult | null = games.x01.result(game.state);
  const was = game.session.result as GameResult | null;
  if (JSON.stringify(result) === JSON.stringify(was)) return game;
  const endedAt = result ? (game.darts[game.darts.length - 1]?.at ?? now()) : null;
  setResult(game.session.id, result, endedAt);
  return { ...game, session: { ...game.session, result, endedAt } };
}

/** Bump when x01Stats changes, so cached values are recomputed. */
const X01_STATS_VERSION = 1;

/** A player's stats for a session, from the cache when it's current. */
export function sessionX01Stats(game: LoadedGame, playerId: string): X01Stats {
  const cached = readCachedStat(game.session.id, playerId, 'x01', X01_STATS_VERSION);
  if (cached) return cached as X01Stats;
  const stats = x01Stats(game.state, playerId);
  writeCachedStat(game.session.id, playerId, 'x01', X01_STATS_VERSION, stats);
  return stats;
}
