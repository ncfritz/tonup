import { eq } from 'drizzle-orm';

import type { Backup } from '@/domain/backup';

import { db } from './client';
import { darts, players, sessionPlayers, sessions, statsCache } from './schema';

/** Everything a backup holds. */
export function dumpAll(): Pick<Backup, 'players' | 'sessions' | 'sessionPlayers' | 'darts'> {
  return {
    players: db.select().from(players).all(),
    sessions: db.select().from(sessions).all(),
    sessionPlayers: db.select().from(sessionPlayers).all(),
    darts: db.select().from(darts).all(),
  };
}

/**
 * Adds a backup's rows, keeping anything already here (same ids are skipped), in one
 * transaction. Returns how many sessions were new.
 */
export function restore(b: Backup): { sessions: number; skipped: number } {
  const known = new Set(
    db
      .select({ id: sessions.id })
      .from(sessions)
      .all()
      .map((r) => r.id),
  );
  const fresh = b.sessions.filter((s) => !known.has(s.id));
  const freshIds = new Set(fresh.map((s) => s.id));
  db.transaction((tx) => {
    for (const p of b.players) tx.insert(players).values(p).onConflictDoNothing().run();
    for (const s of fresh) tx.insert(sessions).values(s).run();
    for (const r of b.sessionPlayers) {
      if (freshIds.has(r.sessionId)) tx.insert(sessionPlayers).values(r).run();
    }
    for (const d of b.darts) {
      if (freshIds.has(d.sessionId)) {
        tx.insert(darts)
          .values(d as typeof darts.$inferInsert)
          .run();
      }
    }
    // Stats are rebuilt from the darts on demand.
    for (const id of freshIds) tx.delete(statsCache).where(eq(statsCache.sessionId, id)).run();
  });
  return { sessions: fresh.length, skipped: b.sessions.length - fresh.length };
}
