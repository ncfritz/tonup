// Lab's database (capture-lab.md › Data). L0 has sessions only; captures, labels, runs and
// models arrive with L1 and L3.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  device: text('device'),
  /** train, val or test, fixed when Lab first sees the session (lib/splits.ts). */
  split: text('split', { enum: ['train', 'val', 'test'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
