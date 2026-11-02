import { asc, isNull } from 'drizzle-orm';

import type { PlayerRef } from '@/domain/darts';

import { db } from './client';
import { players } from './schema';

const toRef = (r: typeof players.$inferSelect): PlayerRef =>
  r.botLevel === null
    ? { id: r.id, name: r.name }
    : { id: r.id, name: r.name, botLevel: r.botLevel };

/** Adds the player, or updates their name and level if they already exist. */
export function savePlayer(p: PlayerRef & { color?: string | null }, now = Date.now()): void {
  db.insert(players)
    .values({
      id: p.id,
      name: p.name,
      color: p.color ?? null,
      botLevel: p.botLevel ?? null,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: players.id,
      set: { name: p.name, botLevel: p.botLevel ?? null },
    })
    .run();
}

/** Players not archived, oldest first. */
export function listPlayers(): PlayerRef[] {
  return db
    .select()
    .from(players)
    .where(isNull(players.archivedAt))
    .orderBy(asc(players.createdAt))
    .all()
    .map(toRef);
}
