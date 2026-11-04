// Verification (capture-lab.md › Runs, Verify): a verification run evaluates chosen models on a
// fresh snapshot of the verify set, so models compared in one run are compared on the same
// photos. Training runs record their own check the same way. Each model's totals go to
// verify_results and each photo's outcome, with its conditions as of the snapshot, to
// verify_items, which the breakdown and the worst-photos gallery read.
import fs from 'node:fs';
import path from 'node:path';

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { boardFrac, CONDITIONS, isThin, type ConditionValues } from './buckets';
import { db } from './db/client';
import {
  captures,
  conditions,
  models,
  runs,
  sessions,
  snapshots,
  verifyItems,
  verifyResults,
} from './db/schema';
import { getRun, listRuns, type RunSummary } from './runs';
import type { SnapshotLabel } from './snapshots';

export const verifyParams = z.object({
  modelIds: z
    .array(z.number().int().positive())
    .min(1, 'Pick a model to verify')
    .max(4, 'Up to four models at a time')
    .refine((ids) => new Set(ids).size === ids.length, 'Each model once'),
});
export type VerifyParams = z.infer<typeof verifyParams>;

export function createVerifyRun(params: VerifyParams, now = new Date()) {
  const [row] = db()
    .insert(runs)
    .values({ kind: 'verify', status: 'queued', params: JSON.stringify(params), createdAt: now })
    .returning()
    .all();
  return row!;
}

/** evaluate's --out file. */
interface EvalTotals {
  samples: number;
  visit_correct: number;
  dart_correct: number;
  board_found: number;
}

/** One line of evaluate's --predictions file. */
interface PredictionLine {
  image: string;
  values_only?: boolean;
  board_found: boolean;
  darts: number;
  darts_right: number;
  visit_correct: boolean;
  want_total: number;
  got_total: number | null;
  predicted: { calibration: Record<string, [number, number]>; tips: [number, number][] };
}

/**
 * Stores one model's verification on a snapshot from evaluate's files, and makes those the
 * model's current numbers (the latest verification is the one on the most photos).
 */
export function recordVerification(o: {
  runId: number;
  modelId: number;
  snapshotId: number;
  evalFile: string;
  predictionsFile: string;
  now?: Date;
}) {
  const d = db();
  const totals = JSON.parse(fs.readFileSync(o.evalFile, 'utf8')) as EvalTotals;
  const lines = fs.existsSync(o.predictionsFile)
    ? fs
        .readFileSync(o.predictionsFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as PredictionLine)
    : [];
  // Snapshot photos are named <captureId>.jpg.
  const ids = lines.map((l) => path.parse(l.image).name);
  const cond = new Map(
    ids.length
      ? d
          .select({
            id: captures.id,
            width: captures.width,
            height: captures.height,
            angleDeg: conditions.angleDeg,
            boardPx: conditions.boardPx,
            brightness: conditions.brightness,
            dartCount: conditions.dartCount,
            tightGroup: conditions.tightGroup,
          })
          .from(captures)
          .leftJoin(conditions, eq(conditions.captureId, captures.id))
          .where(inArray(captures.id, ids))
          .all()
          .map((c) => [c.id, c])
      : [],
  );
  const now = o.now ?? new Date();
  const valuesOnly = lines.filter((l) => l.values_only).length;
  d.transaction((tx) => {
    tx.insert(verifyResults)
      .values({
        runId: o.runId,
        modelId: o.modelId,
        snapshotId: o.snapshotId,
        samples: totals.samples,
        valuesOnly,
        visitCorrect: totals.visit_correct,
        dartCorrect: totals.dart_correct,
        boardFound: totals.board_found,
        createdAt: now,
      })
      .run();
    for (const [i, l] of lines.entries()) {
      const c = cond.get(ids[i]!);
      tx.insert(verifyItems)
        .values({
          runId: o.runId,
          modelId: o.modelId,
          captureId: ids[i]!,
          valuesOnly: Boolean(l.values_only),
          boardFound: l.board_found,
          darts: l.darts,
          dartsRight: l.darts_right,
          visitCorrect: l.visit_correct,
          wantTotal: l.want_total,
          gotTotal: l.got_total,
          predicted: JSON.stringify(l.predicted),
          angleDeg: c?.angleDeg ?? null,
          boardFrac: c ? boardFrac(c.boardPx ?? null, c.width, c.height) : null,
          brightness: c?.brightness ?? null,
          dartCount: c?.dartCount ?? l.darts,
          tightGroup: c?.tightGroup ?? false,
        })
        .run();
    }
    tx.update(models)
      .set({
        evaluatedOn: `verify set, snapshot ${o.snapshotId}`,
        samples: totals.samples,
        visitCorrect: totals.visit_correct,
        dartCorrect: totals.dart_correct,
        boardFound: totals.board_found,
      })
      .where(eq(models.id, o.modelId))
      .run();
  });
  return totals;
}

export interface ResultRow {
  modelId: number;
  model: string;
  modelStatus: string;
  samples: number;
  valuesOnly: number;
  visitCorrect: number;
  dartCorrect: number;
  boardFound: number;
}

function resultsFor(runIds: number[]): Map<number, ResultRow[]> {
  if (!runIds.length) return new Map();
  const rows = db()
    .select({
      runId: verifyResults.runId,
      modelId: verifyResults.modelId,
      model: models.name,
      modelStatus: models.status,
      samples: verifyResults.samples,
      valuesOnly: verifyResults.valuesOnly,
      visitCorrect: verifyResults.visitCorrect,
      dartCorrect: verifyResults.dartCorrect,
      boardFound: verifyResults.boardFound,
    })
    .from(verifyResults)
    .innerJoin(models, eq(models.id, verifyResults.modelId))
    .where(inArray(verifyResults.runId, runIds))
    .orderBy(asc(models.id))
    .all();
  const out = new Map<number, ResultRow[]>();
  for (const { runId, ...r } of rows) out.set(runId, [...(out.get(runId) ?? []), r]);
  return out;
}

export interface VerificationListItem {
  run: RunSummary;
  results: ResultRow[];
  /** Models asked for (a queued or failed run has no results yet). */
  models: string[];
}

/** Verification runs, and training runs that checked their model on the verify set. */
export function listVerifications(limit = 50): VerificationListItem[] {
  const withResults = new Set(
    db()
      .selectDistinct({ id: verifyResults.runId })
      .from(verifyResults)
      .all()
      .map((r) => r.id),
  );
  const list = listRuns(500)
    .filter((r) => r.kind === 'verify' || withResults.has(r.id))
    .slice(0, limit);
  const results = resultsFor(list.map((r) => r.id));
  return list.map((run) => ({
    run,
    results: results.get(run.id) ?? [],
    models: run.kind === 'verify' ? run.models : run.model ? [run.model] : [],
  }));
}

export interface BucketScore {
  bucket: string;
  /** Per model id. */
  by: Record<number, { n: number; visit: number; dart: number; board: number }>;
}

export interface Breakdown {
  key: string;
  title: string;
  buckets: BucketScore[];
  /** Photos the condition couldn't be measured for (no board marks). */
  unmeasured: number;
}

export interface WorstItem {
  captureId: string;
  modelId: number;
  model: string;
  valuesOnly: boolean;
  boardFound: boolean;
  darts: number;
  dartsRight: number;
  wantTotal: number;
  gotTotal: number | null;
  width: number;
  height: number;
  predicted: PredictionLine['predicted'];
  /** The label it was verified against, from the snapshot. */
  truth: {
    calibration: SnapshotLabel['calibration'];
    tips: { x: number; y: number }[];
    values: string[];
  } | null;
}

export interface Verification {
  run: RunSummary;
  results: ResultRow[];
  snapshot: { id: number; test: number } | null;
  breakdown: Breakdown[];
  worst: WorstItem[];
}

const WORST = 36;

export function getVerification(runId: number): Verification | null {
  const data = getRun(runId);
  if (!data) return null;
  const d = db();
  const results = resultsFor([runId]).get(runId) ?? [];
  const snap = data.run.snapshotId
    ? (d.select().from(snapshots).where(eq(snapshots.id, data.run.snapshotId)).get() ?? null)
    : null;
  const items = d.select().from(verifyItems).where(eq(verifyItems.runId, runId)).all();

  const breakdown: Breakdown[] = CONDITIONS.map((c) => {
    const acc = new Map<string, BucketScore['by']>();
    let unmeasured = 0;
    for (const it of items) {
      const b = c.of(it as ConditionValues);
      if (b == null) {
        unmeasured++;
        continue;
      }
      const by = acc.get(b) ?? {};
      const s = (by[it.modelId] ??= { n: 0, visit: 0, dart: 0, board: 0 });
      s.n++;
      s.visit += Number(it.visitCorrect);
      s.board += Number(it.boardFound);
      s.dart += it.darts ? it.dartsRight / it.darts : Number(it.visitCorrect);
      acc.set(b, by);
    }
    const buckets = c.buckets.flatMap((bucket) => {
      const by = acc.get(bucket);
      if (!by) return [];
      for (const s of Object.values(by)) {
        s.visit /= s.n;
        s.dart /= s.n;
        s.board /= s.n;
      }
      return [{ bucket, by }];
    });
    // Each photo counts once per model.
    return {
      key: c.key,
      title: c.title,
      buckets,
      unmeasured: unmeasured / Math.max(1, results.length),
    };
  });

  const names = new Map(results.map((r) => [r.modelId, r.model]));
  const wrong = items
    .filter((it) => !it.visitCorrect)
    .sort(
      (a, b) =>
        Number(a.boardFound) - Number(b.boardFound) ||
        b.darts - b.dartsRight - (a.darts - a.dartsRight) ||
        Math.abs((b.gotTotal ?? 0) - b.wantTotal) - Math.abs((a.gotTotal ?? 0) - a.wantTotal),
    )
    .slice(0, WORST);
  const dims = new Map(
    wrong.length
      ? d
          .select({ id: captures.id, width: captures.width, height: captures.height })
          .from(captures)
          .where(inArray(captures.id, [...new Set(wrong.map((w) => w.captureId))]))
          .all()
          .map((c) => [c.id, c])
      : [],
  );
  const truthOf = (id: string): WorstItem['truth'] => {
    if (!snap) return null;
    try {
      const l = JSON.parse(
        fs.readFileSync(path.join(snap.path, `${id}.json`), 'utf8'),
      ) as SnapshotLabel;
      return {
        calibration: l.calibration,
        tips: l.darts.flatMap((t) => (t.x != null && t.y != null ? [{ x: t.x, y: t.y }] : [])),
        values: l.darts.flatMap((t) => (t.value ? [t.value] : [])),
      };
    } catch {
      return null;
    }
  };
  const worst = wrong.flatMap((it) => {
    const dim = dims.get(it.captureId);
    if (!dim) return [];
    return [
      {
        captureId: it.captureId,
        modelId: it.modelId,
        model: names.get(it.modelId) ?? `#${it.modelId}`,
        valuesOnly: it.valuesOnly,
        boardFound: it.boardFound,
        darts: it.darts,
        dartsRight: it.dartsRight,
        wantTotal: it.wantTotal,
        gotTotal: it.gotTotal,
        width: dim.width,
        height: dim.height,
        predicted: JSON.parse(it.predicted) as WorstItem['predicted'],
        truth: truthOf(it.captureId),
      },
    ];
  });

  return {
    run: data.run,
    results,
    snapshot: snap ? { id: snap.id, test: snap.test } : null,
    breakdown,
    worst,
  };
}

/** Each model's latest numbers on our verify set, oldest model first (Overview, Models). */
export function modelProgress() {
  return db()
    .select({
      id: models.id,
      name: models.name,
      status: models.status,
      evaluatedOn: models.evaluatedOn,
      samples: models.samples,
      visitCorrect: models.visitCorrect,
      dartCorrect: models.dartCorrect,
      boardFound: models.boardFound,
    })
    .from(models)
    .orderBy(asc(models.id))
    .all()
    .filter((m) => m.evaluatedOn?.startsWith('verify set') && m.visitCorrect != null);
}
export type ModelProgress = ReturnType<typeof modelProgress>;

export interface CoverageBucket {
  bucket: string;
  training: number;
  verify: number;
  thin: boolean;
}

export interface Coverage {
  key: string;
  title: string;
  buckets: CoverageBucket[];
  unmeasured: number;
}

/** How many photos each condition bucket has, for training (train and val) and verify. */
export function coverage(): Coverage[] {
  const rows = db()
    .select({
      split: sessions.split,
      width: captures.width,
      height: captures.height,
      angleDeg: conditions.angleDeg,
      boardPx: conditions.boardPx,
      brightness: conditions.brightness,
      dartCount: conditions.dartCount,
      tightGroup: conditions.tightGroup,
    })
    .from(captures)
    .innerJoin(sessions, eq(sessions.id, captures.sessionId))
    .innerJoin(conditions, eq(conditions.captureId, captures.id))
    .where(inArray(captures.status, ['labelled', 'values-only']))
    .all()
    .map((r) => ({
      split: r.split,
      values: {
        angleDeg: r.angleDeg,
        boardFrac: boardFrac(r.boardPx, r.width, r.height),
        brightness: r.brightness,
        dartCount: r.dartCount,
        tightGroup: r.tightGroup,
      } satisfies ConditionValues,
    }));
  return CONDITIONS.map((c) => {
    const counts = new Map(c.buckets.map((b) => [b, { training: 0, verify: 0 }]));
    let unmeasured = 0;
    for (const r of rows) {
      const b = c.of(r.values);
      if (b == null) {
        unmeasured++;
        continue;
      }
      const k = counts.get(b)!;
      if (r.split === 'test') k.verify++;
      else k.training++;
    }
    return {
      key: c.key,
      title: c.title,
      unmeasured,
      buckets: c.buckets.map((bucket) => {
        const k = counts.get(bucket)!;
        return { bucket, ...k, thin: isThin(k.training + k.verify, k.verify) };
      }),
    };
  });
}

/** The latest verification run first, for the Models page's "last compared" link. */
export function latestVerifyRun() {
  return (
    db()
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.kind, 'verify'), eq(runs.status, 'done')))
      .orderBy(desc(runs.id))
      .get() ?? null
  );
}
