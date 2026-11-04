import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { dataDir } from '../env';
import * as schema from './schema';

export type LabDb = BetterSQLite3Database<typeof schema>;

// One connection per server process; kept on globalThis so dev hot reloads reuse it.
const g = globalThis as unknown as { labDb?: LabDb };

/** Opens (and migrates) `<data dir>/lab.db`, creating the data folder on first run. */
export function db(): LabDb {
  if (g.labDb) return g.labDb;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(path.join(dir, 'lab.db'));
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const instance = drizzle(sqlite, { schema });
  migrate(instance, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
  g.labDb = instance;
  return instance;
}

/** Tests only: forget the open connection (after pointing TONUP_LAB_DATA somewhere new). */
export function closeDbForTests() {
  const sqlite = (g.labDb as unknown as { $client?: { close(): void } } | undefined)?.$client;
  sqlite?.close();
  g.labDb = undefined;
}
