import { count, desc, lt } from 'drizzle-orm';

import { db } from '@/services/db/client';
import { darts, diagnosticsLog, sessions } from '@/services/db/schema';

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

export interface LogRow {
  createdAt: number;
  level: Level;
  message: string;
  context: string | null;
}

/** The newest log rows, newest first, for Report a problem. */
export function recentLog(limit = 100): LogRow[] {
  return db
    .select({
      createdAt: diagnosticsLog.createdAt,
      level: diagnosticsLog.level,
      message: diagnosticsLog.message,
      context: diagnosticsLog.context,
    })
    .from(diagnosticsLog)
    .orderBy(desc(diagnosticsLog.id))
    .limit(limit)
    .all();
}

/** How much is stored: sessions and darts, for Report a problem. */
export function storedCounts(): { sessions: number; darts: number } {
  const s = db.select({ n: count() }).from(sessions).get()?.n ?? 0;
  const d = db.select({ n: count() }).from(darts).get()?.n ?? 0;
  return { sessions: s, darts: d };
}

type ErrorHandler = (error: unknown, isFatal?: boolean) => void;
declare const ErrorUtils:
  { getGlobalHandler(): ErrorHandler; setGlobalHandler(h: ErrorHandler): void } | undefined;

/** Logs uncaught JavaScript errors before React Native's own handler runs. */
export function installErrorLogging() {
  if (typeof ErrorUtils === 'undefined') return;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    const e = error instanceof Error ? error : new Error(String(error));
    log('error', isFatal ? 'Fatal error' : 'Uncaught error', {
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 8).join('\n'),
    });
    previous(error, isFatal);
  });
}
