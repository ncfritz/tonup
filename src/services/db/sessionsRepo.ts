import { and, asc, desc, eq, gte, isNotNull, isNull } from 'drizzle-orm';

import type { DartEvent, PlayerRef } from '@/domain/darts';

import { db } from './client';
import { dartFromRow, rowFromDart } from './mappers';
import { savePlayer } from './playersRepo';
import { darts, players, sessionPlayers, sessions, statsCache } from './schema';

export interface SessionRecord {
  id: string;
  kind: 'game' | 'drill';
  typeId: string;
  settings: unknown;
  boardType: 'steel';
  players: PlayerRef[];
  startedAt: number;
  endedAt: number | null;
  abandonedAt: number | null;
  result: unknown;
}

const parse = (json: string | null): unknown => (json === null ? null : JSON.parse(json));

export function createSession(s: {
  id: string;
  kind: 'game' | 'drill';
  typeId: string;
  settings: unknown;
  players: PlayerRef[];
  startedAt: number;
}): void {
  db.transaction((tx) => {
    for (const p of s.players) savePlayer(p, s.startedAt);
    tx.insert(sessions)
      .values({
        id: s.id,
        kind: s.kind,
        typeId: s.typeId,
        settings: JSON.stringify(s.settings),
        boardType: 'steel',
        startedAt: s.startedAt,
      })
      .run();
    s.players.forEach((p, position) =>
      tx.insert(sessionPlayers).values({ sessionId: s.id, position, playerId: p.id }).run(),
    );
  });
}

export function getSession(id: string): SessionRecord | null {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) return null;
  const ps = db
    .select({ id: players.id, name: players.name, botLevel: players.botLevel })
    .from(sessionPlayers)
    .innerJoin(players, eq(players.id, sessionPlayers.playerId))
    .where(eq(sessionPlayers.sessionId, id))
    .orderBy(asc(sessionPlayers.position))
    .all()
    .map((p) =>
      p.botLevel === null
        ? { id: p.id, name: p.name }
        : { id: p.id, name: p.name, botLevel: p.botLevel },
    );
  return {
    id: row.id,
    kind: row.kind,
    typeId: row.typeId,
    settings: parse(row.settings),
    boardType: row.boardType,
    players: ps,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    abandonedAt: row.abandonedAt,
    result: parse(row.result),
  };
}

/** A session's darts in order. */
export function loadDarts(sessionId: string): DartEvent[] {
  return db
    .select()
    .from(darts)
    .where(eq(darts.sessionId, sessionId))
    .orderBy(asc(darts.seq))
    .all()
    .map(dartFromRow);
}

const clearStats = (sessionId: string) =>
  db.delete(statsCache).where(eq(statsCache.sessionId, sessionId)).run();

export function appendDart(d: DartEvent): void {
  db.insert(darts).values(rowFromDart(d)).run();
  clearStats(d.sessionId);
}

/** Replaces darts from `fromSeq` on with `replacement` (an edit, or an undo with none). */
export function replaceDartsFrom(
  sessionId: string,
  fromSeq: number,
  replacement: DartEvent[] = [],
): void {
  db.transaction((tx) => {
    tx.delete(darts)
      .where(and(eq(darts.sessionId, sessionId), gte(darts.seq, fromSeq)))
      .run();
    for (const d of replacement) tx.insert(darts).values(rowFromDart(d)).run();
  });
  clearStats(sessionId);
}

export function setResult(sessionId: string, result: unknown, endedAt: number | null): void {
  db.update(sessions)
    .set({ result: result === null ? null : JSON.stringify(result), endedAt })
    .where(eq(sessions.id, sessionId))
    .run();
}

export function abandonSession(sessionId: string, at = Date.now()): void {
  db.update(sessions).set({ abandonedAt: at }).where(eq(sessions.id, sessionId)).run();
}

/** The most recent session that is neither finished nor abandoned, for Resume on Home. */
export function latestUnfinished(kind?: 'game' | 'drill'): string | null {
  const open = and(isNull(sessions.endedAt), isNull(sessions.abandonedAt));
  const row = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(kind ? and(open, eq(sessions.kind, kind)) : open)
    .orderBy(desc(sessions.startedAt))
    .limit(1)
    .get();
  return row?.id ?? null;
}

/** The most recently finished session of a kind, for the Last match and Last practice cards. */
export function latestFinished(kind: 'game' | 'drill'): string | null {
  const row = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.kind, kind), isNotNull(sessions.endedAt)))
    .orderBy(desc(sessions.endedAt))
    .limit(1)
    .get();
  return row?.id ?? null;
}

/** Finished sessions of one type, newest first, with their results. */
export function finishedOfType(
  kind: 'game' | 'drill',
  typeId: string,
  limit = 500,
): { id: string; endedAt: number; result: unknown }[] {
  return db
    .select({ id: sessions.id, endedAt: sessions.endedAt, result: sessions.result })
    .from(sessions)
    .where(and(eq(sessions.kind, kind), eq(sessions.typeId, typeId), isNotNull(sessions.endedAt)))
    .orderBy(desc(sessions.endedAt))
    .limit(limit)
    .all()
    .map((r) => ({ id: r.id, endedAt: r.endedAt!, result: parse(r.result) }));
}

/** Recent sessions, newest first. */
export function recentSessions(limit = 20): string[] {
  return db
    .select({ id: sessions.id })
    .from(sessions)
    .orderBy(desc(sessions.startedAt))
    .limit(limit)
    .all()
    .map((r) => r.id);
}

export function deleteSession(sessionId: string): void {
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

export function readCachedStat(
  sessionId: string,
  playerId: string,
  key: string,
  version: number,
): unknown | undefined {
  const row = db
    .select()
    .from(statsCache)
    .where(
      and(
        eq(statsCache.sessionId, sessionId),
        eq(statsCache.playerId, playerId),
        eq(statsCache.key, key),
      ),
    )
    .get();
  return row && row.version === version ? JSON.parse(row.value) : undefined;
}

export function writeCachedStat(
  sessionId: string,
  playerId: string,
  key: string,
  version: number,
  value: unknown,
): void {
  const json = JSON.stringify(value);
  db.insert(statsCache)
    .values({ sessionId, playerId, key, version, value: json })
    .onConflictDoUpdate({
      target: [statsCache.sessionId, statsCache.playerId, statsCache.key],
      set: { version, value: json },
    })
    .run();
}
