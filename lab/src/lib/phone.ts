// What Capture's Overview and Models tabs read (capture-lab.md › API used by Capture). The
// same numbers as Lab's own pages, without the file paths a phone has no use for.
import { overviewCounts, prefillStats, type OverviewCounts, type PrefillStats } from './queries';
import { activeModel, listModels } from './runs';
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
