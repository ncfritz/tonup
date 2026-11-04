// Dataset snapshots (capture-lab.md › Runs): before a run, the current labels of every capture
// that isn't left out are written to <data>/snapshots/<id>/ in the format ml/ reads
// (tonup_ml.data.captures), with each photo hard-linked beside its label. A run always knows
// exactly what it trained and verified on, even after labels change.
import fs from 'node:fs';
import path from 'node:path';

import { CALIBRATION_IDS } from '@domain/camera';
import { asc, eq, inArray, ne } from 'drizzle-orm';

import { db } from './db/client';
import { captures, labelDarts, labelPoints, sessions, snapshots } from './db/schema';
import { dataDir } from './env';
import { photosDir } from './storage';

export interface SnapshotInfo {
  id: number;
  path: string;
  train: number;
  val: number;
  test: number;
  valuesOnly: number;
}

/** The label file ml/ reads: DeepDarts-ordered points, darts with their values, and the split. */
export interface SnapshotLabel {
  image: string;
  calibration: ({ x: number; y: number } | null)[];
  darts: { x: number | null; y: number | null; value: string | null; onWire: boolean }[];
  createdAt: string;
  sessionId: string;
  split: 'train' | 'val' | 'test';
  valuesOnly: boolean;
}

function link(from: string, to: string) {
  try {
    fs.linkSync(from, to);
  } catch {
    fs.copyFileSync(from, to);
  }
}

export function createSnapshot(now = new Date()): SnapshotInfo {
  const d = db();
  const rows = d
    .select({
      id: captures.id,
      photo: captures.photo,
      takenAt: captures.takenAt,
      status: captures.status,
      labelId: captures.labelId,
      sessionId: captures.sessionId,
      split: sessions.split,
    })
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .where(ne(captures.status, 'rejected'))
    .orderBy(asc(captures.takenAt))
    .all()
    .filter((r) => r.labelId !== null);
  const labelIds = rows.map((r) => r.labelId!);
  const points = new Map<number, Map<string, { x: number; y: number }>>();
  const darts = new Map<number, SnapshotLabel['darts']>();
  if (labelIds.length) {
    for (const p of d
      .select()
      .from(labelPoints)
      .where(inArray(labelPoints.labelId, labelIds))
      .all()) {
      const m = points.get(p.labelId) ?? new Map();
      m.set(p.kind, { x: p.x, y: p.y });
      points.set(p.labelId, m);
    }
    for (const r of d
      .select()
      .from(labelDarts)
      .where(inArray(labelDarts.labelId, labelIds))
      .orderBy(asc(labelDarts.idx))
      .all()) {
      darts.set(r.labelId, [
        ...(darts.get(r.labelId) ?? []),
        { x: r.x, y: r.y, value: r.entered, onWire: r.onWire },
      ]);
    }
  }

  const [row] = d
    .insert(snapshots)
    .values({ createdAt: now, path: '', train: 0, val: 0, test: 0, valuesOnly: 0 })
    .returning({ id: snapshots.id })
    .all();
  const id = row!.id;
  const dir = path.join(dataDir(), 'snapshots', String(id));
  fs.mkdirSync(dir, { recursive: true });
  const counts = { train: 0, val: 0, test: 0, valuesOnly: 0 };
  for (const r of rows) {
    const src = path.join(photosDir(), r.photo);
    if (!fs.existsSync(src)) continue;
    const image = `${r.id}.jpg`;
    link(src, path.join(dir, image));
    const pts = points.get(r.labelId!) ?? new Map();
    const valuesOnly = r.status === 'values-only';
    const label: SnapshotLabel = {
      image,
      calibration: CALIBRATION_IDS.map((k) => pts.get(k) ?? null),
      darts: darts.get(r.labelId!) ?? [],
      createdAt: r.takenAt.toISOString(),
      sessionId: r.sessionId,
      split: r.split,
      valuesOnly,
    };
    fs.writeFileSync(path.join(dir, `${r.id}.json`), JSON.stringify(label));
    counts[r.split]++;
    if (valuesOnly) counts.valuesOnly++;
  }
  fs.writeFileSync(
    path.join(dir, 'manifest.json'),
    JSON.stringify({ id, createdAt: now.toISOString(), ...counts }, null, 2),
  );
  d.update(snapshots)
    .set({ path: dir, ...counts })
    .where(eq(snapshots.id, id))
    .run();
  return { id, path: dir, ...counts };
}
