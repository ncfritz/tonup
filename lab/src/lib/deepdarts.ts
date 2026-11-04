// The DeepDarts dataset (CC BY 4.0, ml/README.md › Data). Lab doesn't copy its 16k photos; it
// remembers where the download is and checks it, and training reads it from there.
import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';

import { db } from './db/client';
import { settings } from './db/schema';

const KEY = 'deepdartsPath';

export function deepdartsPath(): string | null {
  return db().select().from(settings).where(eq(settings.key, KEY)).get()?.value ?? null;
}

export interface DeepdartsSummary {
  path: string;
  ok: boolean;
  hasLabels: boolean;
  folders: number;
  photos: number;
  problem: string | null;
}

/** Checks a DeepDarts folder: labels.pkl and cropped_images/800/<folder>/*.jpg. */
export function summarise(folder: string): DeepdartsSummary {
  const dir = path.resolve(folder);
  const base = { path: dir, ok: false, hasLabels: false, folders: 0, photos: 0 };
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { ...base, problem: 'No folder there' };
  }
  const hasLabels = fs.existsSync(path.join(dir, 'labels.pkl'));
  const crops = path.join(dir, 'cropped_images', '800');
  if (!fs.existsSync(crops)) {
    return {
      ...base,
      hasLabels,
      problem: 'No cropped_images/800 folder (unzip cropped_images.zip here)',
    };
  }
  let folders = 0;
  let photos = 0;
  for (const sub of fs.readdirSync(crops, { withFileTypes: true })) {
    if (!sub.isDirectory()) continue;
    folders++;
    photos += fs.readdirSync(path.join(crops, sub.name)).filter((f) => /\.jpe?g$/i.test(f)).length;
  }
  const problem = !hasLabels
    ? 'No labels.pkl (unzip labels_pkl.zip here)'
    : photos === 0
      ? 'No photos found'
      : null;
  return { path: dir, ok: problem === null, hasLabels, folders, photos, problem };
}

export function setDeepdartsPath(folder: string): DeepdartsSummary {
  const summary = summarise(folder);
  db()
    .insert(settings)
    .values({ key: KEY, value: summary.path })
    .onConflictDoUpdate({ target: settings.key, set: { value: summary.path } })
    .run();
  return summary;
}

export function deepdartsSummary(): DeepdartsSummary | null {
  const p = deepdartsPath();
  return p ? summarise(p) : null;
}
