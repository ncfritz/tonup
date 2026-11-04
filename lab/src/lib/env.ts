import os from 'node:os';
import path from 'node:path';

/** Where Lab keeps its database, photos, runs and models: outside the repo (capture-lab.md). */
export function dataDir(): string {
  const configured = process.env.TONUP_LAB_DATA;
  if (configured) return path.resolve(configured);
  return path.join(os.homedir(), 'TonUpLab');
}

export const LAB_VERSION = '0.1.0';
