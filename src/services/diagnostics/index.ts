import { desc, lt } from 'drizzle-orm';

import { db } from '@/services/db/client';
import { diagnosticsLog } from '@/services/db/schema';

type Level = 'error' | 'warn' | 'info';

const MAX_ROWS = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Local-only diagnostics (ADR 0001): kept on the phone, shown only in Report a problem. */
export function log(level: Level, message: string, context?: Record<string, unknown>) {
  try {
    db.insert(diagnosticsLog)
      .values({
        createdAt: Date.now(),
        level,
        message,
        context: context ? JSON.stringify(context) : null,
      })
      .run();
  } catch {
    // Diagnostics must never break the app.
  }
  if (__DEV__) console[level === 'info' ? 'log' : level](`[${level}] ${message}`, context ?? '');
}

/** Keeps the last 500 rows or 30 days, whichever is smaller. */
export function pruneLog() {
  db.delete(diagnosticsLog)
    .where(lt(diagnosticsLog.createdAt, Date.now() - MAX_AGE_MS))
    .run();
  const rows = db
    .select({ id: diagnosticsLog.id })
    .from(diagnosticsLog)
    .orderBy(desc(diagnosticsLog.id))
    .limit(1)
    .offset(MAX_ROWS - 1)
    .all();
  const cutoff = rows[0]?.id;
  if (cutoff !== undefined) db.delete(diagnosticsLog).where(lt(diagnosticsLog.id, cutoff)).run();
}
