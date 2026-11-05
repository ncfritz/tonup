// What Capture's Overview and Models tabs read (capture-lab.md › API used by Capture). The
// same numbers as Lab's own pages, without the file paths a phone has no use for.
import { and, desc, eq } from 'drizzle-orm';

import { db } from './db/client';
import { models, verifyResults } from './db/schema';
import { overviewCounts, prefillStats, type OverviewCounts, type PrefillStats } from './queries';
import { activeModel, getRun, listModels } from './runs';
import { coverage, modelProgress, type Coverage } from './verify';

export interface PhoneScores {
  id: number;
  name: string;
  status: 'candidate' | 'active' | 'retired';
  runId: number;
  createdAt: number;
  /** "verify set (snapshot 7)", or null before its first verification. */
  evaluatedOn: string | null;
  samples: number | null;
  visitCorrect: number | null;
  dartCorrect: number | null;
  boardFound: number | null;
  /** It has a Core ML package, so Capture can pull it. */
  exported: boolean;
}

export interface PhoneOverview {
  counts: OverviewCounts;
  active: PhoneScores | null;
  /** Each model's latest numbers on the verify set, oldest first. */
  progress: { name: string; visitCorrect: number; dartCorrect: number; boardFound: number }[];
  coverage: Coverage[];
  prefill: PrefillStats[];
}

export interface PhoneModels {
  /** Newest first. */
  models: PhoneScores[];
  prefill: PrefillStats[];
  /** Photos in the verify set: verifying needs some. */
  testPhotos: number;
}

const scores = (m: ReturnType<typeof listModels>[number]): PhoneScores => ({
  id: m.id,
  name: m.name,
  status: m.status,
  runId: m.runId,
  createdAt: m.createdAt,
  evaluatedOn: m.evaluatedOn,
  samples: m.samples,
  visitCorrect: m.visitCorrect,
  dartCorrect: m.dartCorrect,
  boardFound: m.boardFound,
  exported: !!m.mlpackage,
});

export function phoneOverview(): PhoneOverview {
  const active = activeModel();
  return {
    counts: overviewCounts(),
    active: active ? scores({ ...active, createdAt: active.createdAt.getTime() }) : null,
    progress: modelProgress().map((m) => ({
      name: m.name,
      visitCorrect: m.visitCorrect!,
      dartCorrect: m.dartCorrect ?? 0,
      boardFound: m.boardFound ?? 0,
    })),
    coverage: coverage(),
    prefill: prefillStats(),
  };
}

export function phoneModels(): PhoneModels {
  return {
    models: listModels().map(scores),
    prefill: prefillStats(),
    testPhotos: overviewCounts().bySplit.test,
  };
}

export interface RunComparison {
  /** The model a training run made, with where it stands now. */
  made: { id: number; name: string; status: PhoneScores['status'] } | null;
  /** The model it started from, and its numbers to compare with. */
  base: {
    id: number;
    name: string;
    visitCorrect: number | null;
    dartCorrect: number | null;
    boardFound: number | null;
    /** Measured on the same verify photos as the run's own check (so a fair comparison). */
    sameSnapshot: boolean;
  } | null;
}

/**
 * For Capture's past run: what it made and the model it started from. The base's numbers are
 * from the same snapshot when a verification measured it there, else its latest.
 */
export function runComparison(runId: number): RunComparison | null {
  const data = getRun(runId);
  if (!data) return null;
  const { run } = data;
  const d = db();
  const made = run.modelId
    ? (d
        .select({ id: models.id, name: models.name, status: models.status })
        .from(models)
        .where(eq(models.id, run.modelId))
        .get() ?? null)
    : null;
  const baseId = run.kind === 'train' ? run.params.baseModelId : undefined;
  const baseModel = baseId ? d.select().from(models).where(eq(models.id, baseId)).get() : undefined;
  if (!baseModel) return { made, base: null };
  const same = run.snapshotId
    ? d
        .select()
        .from(verifyResults)
        .where(
          and(
            eq(verifyResults.modelId, baseModel.id),
            eq(verifyResults.snapshotId, run.snapshotId),
          ),
        )
        .orderBy(desc(verifyResults.createdAt))
        .get()
    : undefined;
  const from = same ?? baseModel;
  return {
    made,
    base: {
      id: baseModel.id,
      name: baseModel.name,
      visitCorrect: from.visitCorrect,
      dartCorrect: from.dartCorrect,
      boardFound: from.boardFound,
      sameSnapshot: !!same,
    },
  };
}
