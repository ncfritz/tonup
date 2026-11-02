// An in-memory database for tests: Node's built-in SQLite behind the small part of the
// expo-sqlite API that Drizzle's expo driver uses, with the app's real migrations applied.
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
// eslint-disable-next-line import/no-unresolved -- Node built-in
import { DatabaseSync } from 'node:sqlite';

import migrations from '../src/services/db/migrations/migrations';
import * as schema from '../src/services/db/schema';

type Param = string | number | null | bigint | Uint8Array;
const bind = (params: unknown[]): Param[] =>
  params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : (p as Param)));

function adapter(raw: DatabaseSync) {
  return {
    execSync: (sql: string) => raw.exec(sql),
    prepareSync(sql: string) {
      const stmt = raw.prepare(sql);
      const reads = stmt.columns().length > 0;
      return {
        executeSync(params: unknown[] = []) {
          const args = bind(params);
          if (!reads) {
            const r = stmt.run(...args);
            return {
              changes: Number(r.changes),
              lastInsertRowId: Number(r.lastInsertRowid),
              getAllSync: () => [],
              getFirstSync: () => null,
            };
          }
          return {
            changes: 0,
            lastInsertRowId: 0,
            getAllSync: () => stmt.all(...args),
            getFirstSync: () => stmt.get(...args) ?? null,
          };
        },
        executeForRawResultSync(params: unknown[] = []) {
          const args = bind(params);
          return {
            getAllSync: () => {
              if (!reads) {
                stmt.run(...args);
                return [];
              }
              stmt.setReturnArrays(true);
              try {
                return stmt.all(...args);
              } finally {
                stmt.setReturnArrays(false);
              }
            },
          };
        },
        finalizeSync: () => {},
      };
    },
  };
}

export type TestDatabase = ReturnType<typeof makeDb>;

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const client = adapter(raw);
  // The adapter covers what the driver calls; its types are expo-sqlite's.
  return { raw, db: drizzle(client as never, { schema }) };
}

let current: TestDatabase | null = null;

/** A fresh, migrated database; the mocked `@/services/db/client` points at it. */
export async function resetTestDb(): Promise<TestDatabase> {
  current?.raw.close();
  current = makeDb();
  await migrate(current.db, migrations);
  return current;
}

/** Use as the factory for `jest.mock('@/services/db/client', ...)`. */
export function testClient() {
  const db = new Proxy(
    {},
    {
      get(_t, prop) {
        if (!current) throw new Error('Call resetTestDb() first');
        const value = Reflect.get(current.db, prop);
        return typeof value === 'function' ? value.bind(current.db) : value;
      },
    },
  );
  return { db, sqlite: {}, DATABASE_NAME: 'test.db' };
}
