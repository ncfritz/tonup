// Snap-to-score captures (ADR 0011): a row per confirmed photo, and with "Keep photos to improve
// detection" on, the photo and a JSON of its labels in Documents/captures, where the Files app
// shows them for copying to the Mac (ml/README.md → Our captures). Nothing is uploaded.
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { eq } from 'drizzle-orm';

import type { CaptureLabels } from '@/domain/camera';
import { db } from '@/services/db/client';
import { captures } from '@/services/db/schema';
import { log } from '@/services/diagnostics';
import type { DetectResult } from '@/services/vision';

const folder = () => new Directory(Paths.document, 'captures');

export interface NewCapture {
  sessionId: string;
  firstSeq: number;
  photoUri: string;
  width: number;
  height: number;
  detected: DetectResult | null;
  labels: CaptureLabels;
  keepPhoto: boolean;
  /** The game or drill, for the label file. */
  typeId: string;
}

export function saveCapture(c: NewCapture, now = Date.now()): string {
  const id = randomUUID();
  let photo: string | null = null;
  if (c.keepPhoto) {
    try {
      const dir = folder();
      if (!dir.exists) dir.create();
      const name = `${id}.jpg`;
      new File(c.photoUri).copy(new File(dir, name));
      const meta = new File(dir, `${id}.json`);
      meta.create();
      meta.write(
        JSON.stringify({
          image: name,
          width: c.width,
          height: c.height,
          typeId: c.typeId,
          modelVersion: c.detected?.modelVersion ?? null,
          createdAt: new Date(now).toISOString(),
          ...c.labels,
        }),
      );
      photo = name;
    } catch (e) {
      log('warn', 'capture photo not kept', { error: String(e) });
    }
  }
  db.insert(captures)
    .values({
      id,
      sessionId: c.sessionId,
      firstSeq: c.firstSeq,
      photo,
      width: c.width,
      height: c.height,
      modelVersion: c.detected?.modelVersion ?? null,
      detected: c.detected ? JSON.stringify(c.detected) : null,
      labels: JSON.stringify(c.labels),
      createdAt: now,
    })
    .run();
  return id;
}

/** Deletes a session's kept photos (its rows go with the session). */
export function deleteCapturePhotos(sessionId: string) {
  const rows = db
    .select({ photo: captures.photo })
    .from(captures)
    .where(eq(captures.sessionId, sessionId))
    .all();
  for (const r of rows) {
    if (!r.photo) continue;
    try {
      const dir = folder();
      for (const name of [r.photo, r.photo.replace(/\.jpg$/, '.json')]) {
        const f = new File(dir, name);
        if (f.exists) f.delete();
      }
    } catch {
      // Best effort: a stray photo in Documents does no harm.
    }
  }
}

/** How many photos are kept, for Settings. */
export function keptPhotoCount(): number {
  try {
    const dir = folder();
    return dir.exists ? dir.list().filter((f) => f.name.endsWith('.jpg')).length : 0;
  } catch {
    return 0;
  }
}
