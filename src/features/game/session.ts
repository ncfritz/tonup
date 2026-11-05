// Playing a stored game (M2): every dart goes to the database as it's thrown, and the game is
// rebuilt from its darts on load, undo and edit (ADR 0006).
import { randomUUID } from 'expo-crypto';

import type { DartEvent, DartSource, Hit, PlayerRef, Point, Target } from '@/domain/darts';
import {
  fold,
  foldValid,
  gameFor,
  type GameDefinition,
  type GameId,
  type GameResult,
  type StatLine,
} from '@/domain/games';
import { drillFor, type DrillId } from '@/domain/drills';
import type { X01Settings, X01State } from '@/domain/games/x01';
import { x01Stats, type X01Stats } from '@/domain/stats';
import { useSettings } from '@/features/settings/store';
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
  def: GameDefinition<unknown, unknown>;
  darts: DartEvent[];
  /** The game's own state; X01 screens read it as X01State. */
  state: unknown;
}

/** The state of an X01 game (only call for `typeId === 'x01'`). */
export const x01State = (game: LoadedGame) => game.state as X01State;

/** What the scoring screen knows about a dart; the session fills in the rest. */
export interface DartInput {
  hit: Hit;
  point: Point | null;
  source: DartSource;
  intended?: Target;
}

const now = () => Date.now();

export function startGame(typeId: GameId, given: unknown, players: PlayerRef[]): string {
  // X01 takes your favourite double from Settings for its checkout routes.
  const pref = useSettings.getState().preferredDouble;
  const settings =
    typeId === 'x01' && pref !== null && (given as X01Settings).preferredDouble === undefined
      ? { ...(given as X01Settings), preferredDouble: pref }
      : given;
  // Check the settings and line-up before anything is stored.
  gameFor(typeId).init(settings, players);
  const id = randomUUID();
  createSession({ id, kind: 'game', typeId, settings, players, startedAt: now() });
  return id;
}

/** Starts a drill for one player (you). */
export function startDrill(typeId: DrillId, settings: unknown, player: PlayerRef): string {
  drillFor(typeId).init(settings, [player]);
  const id = randomUUID();
  createSession({ id, kind: 'drill', typeId, settings, players: [player], startedAt: now() });
  return id;
}

export const startX01 = (settings: X01Settings, players: PlayerRef[]) =>
  startGame('x01', settings, players);

const refold = (
  game: { session: SessionRecord; def: GameDefinition<unknown, unknown> },
  darts: DartEvent[],
) => fold(game.def, game.session.settings, game.session.players, darts);

export function loadGame(sessionId: string): LoadedGame {
  const session = getSession(sessionId);
  if (!session) throw new Error(`No session ${sessionId}`);
  // Drills are game definitions too (src/domain/drills/types.ts).
  const def =
    session.kind === 'drill'
      ? (drillFor(session.typeId) as unknown as GameDefinition<unknown, unknown>)
      : gameFor(session.typeId);
  const darts = loadDarts(sessionId);
  return { session, def, darts, state: refold({ session, def }, darts) };
}

/** Records the next dart for whoever is up and returns the new state. */
export function recordDart(game: LoadedGame, input: DartInput): LoadedGame {
  const player = game.def.currentPlayer(game.state);
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
  const state = game.def.applyDart(game.state, dart);
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
  return syncResult({ ...game, darts, state: refold(game, darts) });
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
  return { game: syncResult({ ...game, darts: valid, state: refold(game, valid) }), dropped };
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
  const { applied } = foldValid(game.def, game.session.settings, game.session.players, darts);
  return { darts, kept: applied, dropped: darts.length - applied };
}

/** Keeps the session's stored result in step with the folded state (undo can reopen a game). */
function syncResult(game: LoadedGame): LoadedGame {
  const result: GameResult | null = game.def.result(game.state);
  const was = game.session.result as GameResult | null;
  if (JSON.stringify(result) === JSON.stringify(was)) return game;
  const endedAt = result ? (game.darts[game.darts.length - 1]?.at ?? now()) : null;
  setResult(game.session.id, result, endedAt);
  return { ...game, session: { ...game.session, result, endedAt } };
}

/** Bump when a game's stats change, so cached values are recomputed. */
const STATS_VERSION = 1;

/** A player's X01 stats for a session, from the cache when it's current. */
export function sessionX01Stats(game: LoadedGame, playerId: string): X01Stats {
  const cached = readCachedStat(game.session.id, playerId, 'x01', STATS_VERSION);
  if (cached) return cached as X01Stats;
  const stats = x01Stats(x01State(game), playerId);
  writeCachedStat(game.session.id, playerId, 'x01', STATS_VERSION, stats);
  return stats;
}

/** A player's X01 stats for a stored session, from the cache without loading the game when it can. */
export function x01StatsFor(sessionId: string, playerId: string): X01Stats {
  const cached = readCachedStat(sessionId, playerId, 'x01', STATS_VERSION);
  if (cached) return cached as X01Stats;
  return sessionX01Stats(loadGame(sessionId), playerId);
}

/** A player's summary lines for any game, from the cache when it's current. */
export function sessionStats(game: LoadedGame, playerId: string): StatLine[] {
  const cached = readCachedStat(game.session.id, playerId, 'lines', STATS_VERSION);
  if (cached) return cached as StatLine[];
  const lines = game.def.stats(game.state, playerId);
  writeCachedStat(game.session.id, playerId, 'lines', STATS_VERSION, lines);
  return lines;
}
