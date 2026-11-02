import { eq } from 'drizzle-orm';

import { db } from './client';
import { settings } from './schema';

/** Reads every setting synchronously (startup, before first render). */
export function readAllSettings(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const row of db.select().from(settings).all()) {
    try {
      out[row.key] = JSON.parse(row.value);
    } catch {
      // Ignore malformed values; defaults apply.
    }
  }
  return out;
}

export function writeSetting(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  const now = Date.now();
  db.insert(settings)
    .values({ key, value: json, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: now } })
    .run();
}

export function deleteSetting(key: string): void {
  db.delete(settings).where(eq(settings.key, key)).run();
}
