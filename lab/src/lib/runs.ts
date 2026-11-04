// Runs and models (capture-lab.md › Runs): queueing a training run, reading a run's progress
// from the files its process writes, and the model registry.
import fs from 'node:fs';
import path from 'node:path';

import { count, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { db } from './db/client';
import { models, runs, snapshots } from './db/schema';
import { dataDir } from './env';

export const trainParams = z
  .object({
    /** Start from scratch (ImageNet backbone) or fine-tune an earlier model. */
    from: z.enum(['scratch', 'model']),
    baseModelId: z.number().int().positive().optional(),
    deepdarts: z.boolean(),
    captures: z.boolean(),
    epochs: z.number().int().min(1).max(500),
    lr: z.number().positive().max(1),
    batch: z.number().int().min(1).max(256),
    captureWeight: z.number().int().min(1).max(20),
    /** DeepDarts photos per epoch; 0 means all of them. */
    deepdartsSample: z.number().int().min(0).max(100000),
    workers: z.number().int().min(0).max(16),
  })
  .refine((p) => p.deepdarts || p.captures, {
    message: 'Train on DeepDarts, our captures, or both',
  })
  .refine((p) => p.from === 'scratch' || p.baseModelId, { message: 'Pick the model to fine-tune' });
export type TrainParams = z.infer<typeof trainParams>;

/** Defaults for the form: a DeepDarts baseline, or a fine-tune on our photos. */
export const DEFAULTS: Record<'scratch' | 'model', Omit<TrainParams, 'from' | 'baseModelId'>> = {
  scratch: {
    deepdarts: true,
    captures: true,
    epochs: 60,
    lr: 1e-3,
    batch: 16,
    captureWeight: 3,
    deepdartsSample: 0,
    workers: 4,
  },
  model: {
    deepdarts: true,
    captures: true,
    epochs: 30,
    lr: 3e-4,
    batch: 16,
    captureWeight: 3,
    deepdartsSample: 2000,
    workers: 4,
  },
};

export const runDir = (id: number) => path.join(dataDir(), 'runs', String(id));

export function createTrainRun(params: TrainParams, now = new Date()) {
  const [row] = db()
    .insert(runs)
    .values({
      kind: 'train',
      status: 'queued',
      params: JSON.stringify(params),
      baseModelId: params.from === 'model' ? params.baseModelId : null,
      createdAt: now,
    })
    .returning()
    .all();
  return row!;
}

export interface EpochMetrics {
  epoch: number;
  epochs: number;
  loss: number;
  val_loss: number;
  visit_correct: number;
  dart_correct: number;
  board_found: number;
  seconds: number;
  images_per_second?: number;
  best: boolean;
}

export function readMetrics(id: number): EpochMetrics[] {
  const file = path.join(runDir(id), 'metrics.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as EpochMetrics];
      } catch {
        return [];
      }
    });
}

/** The end of the run's log, and the last "epoch N step i/n" progress line in it. */
export function readLog(id: number, lines = 200) {
  const file = path.join(runDir(id), 'log.txt');
  if (!fs.existsSync(file))
    return { tail: '', step: null as null | { epoch: number; step: number; of: number } };
  const all = fs.readFileSync(file, 'utf8').split('\n');
  let step = null;
  for (let i = all.length - 1; i >= 0; i--) {
    const m = /^epoch (\d+) step (\d+)\/(\d+)/.exec(all[i]!);
    if (m) {
      step = { epoch: Number(m[1]), step: Number(m[2]), of: Number(m[3]) };
      break;
    }
  }
  // Step lines are progress, not history: keep only the latest in the tail.
  const tail = all.filter(
    (l, i) => !/^epoch \d+ step /.test(l) || i === all.length - 1 || i === all.length - 2,
  );
  return { tail: tail.slice(-lines).join('\n'), step };
}

export type RunRow = typeof runs.$inferSelect;
export type ModelRow = typeof models.$inferSelect;

export interface RunSummary extends Omit<RunRow, 'createdAt' | 'startedAt' | 'endedAt' | 'params'> {
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  params: TrainParams;
  baseModel: string | null;
  model: string | null;
  snapshot: { train: number; val: number; test: number } | null;
}

function summarise(
  r: RunRow,
  names: Map<number, string>,
  snaps: Map<number, { train: number; val: number; test: number }>,
): RunSummary {
  return {
    ...r,
    createdAt: r.createdAt.getTime(),
    startedAt: r.startedAt?.getTime() ?? null,
    endedAt: r.endedAt?.getTime() ?? null,
    params: JSON.parse(r.params) as TrainParams,
    baseModel: r.baseModelId ? (names.get(r.baseModelId) ?? null) : null,
    model: r.modelId ? (names.get(r.modelId) ?? null) : null,
    snapshot: r.snapshotId ? (snaps.get(r.snapshotId) ?? null) : null,
  };
}

function lookups(rows: RunRow[]) {
  const d = db();
  const names = new Map(
    d
      .select({ id: models.id, name: models.name })
      .from(models)
      .all()
      .map((m) => [m.id, m.name]),
  );
  const ids = rows.flatMap((r) => (r.snapshotId ? [r.snapshotId] : []));
  const snaps = new Map(
    ids.length
      ? d
          .select()
          .from(snapshots)
          .where(inArray(snapshots.id, ids))
          .all()
          .map((s) => [s.id, { train: s.train, val: s.val, test: s.test }])
      : [],
  );
  return { names, snaps };
}

export function listRuns(limit = 50): RunSummary[] {
  const rows = db().select().from(runs).orderBy(desc(runs.id)).limit(limit).all();
  const { names, snaps } = lookups(rows);
  return rows.map((r) => summarise(r, names, snaps));
}

export function getRun(id: number) {
  const r = db().select().from(runs).where(eq(runs.id, id)).get();
  if (!r) return null;
  const { names, snaps } = lookups([r]);
  return { run: summarise(r, names, snaps), metrics: readMetrics(id), log: readLog(id) };
}

export function listModels(): (Omit<ModelRow, 'createdAt'> & { createdAt: number })[] {
  return db()
    .select()
    .from(models)
    .orderBy(desc(models.id))
    .all()
    .map((m) => ({ ...m, createdAt: m.createdAt.getTime() }));
}

export function activeModel(): ModelRow | null {
  return db().select().from(models).where(eq(models.status, 'active')).get() ?? null;
}

/** Makes a model the one Capture pre-fills with; the previous active one is retired. */
export function activateModel(id: number) {
  const d = db();
  const m = d.select().from(models).where(eq(models.id, id)).get();
  if (!m) return null;
  d.transaction((tx) => {
    tx.update(models).set({ status: 'retired' }).where(eq(models.status, 'active')).run();
    tx.update(models).set({ status: 'active' }).where(eq(models.id, id)).run();
  });
  return { ...m, status: 'active' as const };
}

export const nextModelName = () =>
  `v${(db().select({ n: count() }).from(models).get()?.n ?? 0) + 1}`;
