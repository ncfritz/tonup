import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import type { ReactNode } from 'react';

import { db } from './client';
import migrations from './migrations/migrations';

/** Applies migrations before anything renders. */
export function DatabaseProvider({
  children,
  fallback,
  onError,
}: {
  children: ReactNode;
  fallback: ReactNode;
  onError: (error: Error) => ReactNode;
}) {
  const { success, error } = useMigrations(db, migrations);
  if (error) return onError(error);
  if (!success) return fallback;
  return children;
}
