import { count } from 'drizzle-orm';

import { db } from './db/client';
import { sessions } from './db/schema';
import { dataDir, LAB_VERSION } from './env';
import { labelAt, SELF_CHECK } from './score';

export interface LabStatus {
  app: 'tonup-lab';
  version: string;
  dataDir: string;
  sessions: number;
  /** The model Capture pulls for pre-filling; none until L4. */
  activeModel: string | null;
  scoring: { expected: string; got: string; ok: boolean };
}

/** What /api/health returns and the Overview shows. */
export function labStatus(): LabStatus {
  const [row] = db().select({ n: count() }).from(sessions).all();
  const got = labelAt(SELF_CHECK.radius, SELF_CHECK.deg);
  return {
    app: 'tonup-lab',
    version: LAB_VERSION,
    dataDir: dataDir(),
    sessions: row?.n ?? 0,
    activeModel: null,
    scoring: { expected: SELF_CHECK.expected, got, ok: got === SELF_CHECK.expected },
  };
}
