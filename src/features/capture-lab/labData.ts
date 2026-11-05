// What Capture's Overview, Models and Runs tabs read from Lab (docs/plan/capture-lab.md › API
// used by Capture), and the few things they ask it to do. Shapes mirror lab/src/lib/phone.ts
// and lab/src/lib/runs.ts; only the fields the tabs show.
import { normaliseLabUrl } from './lab';

export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  url: string,
  path: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
): Promise<Reply<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetchImpl(`${normaliseLabUrl(url)}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) return { ok: false, error: body.error ?? `Lab answered ${res.status}` };
    return { ok: true, data: body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

const post = { method: 'POST', headers: { 'Content-Type': 'application/json' } };

/** The three numbers every model is judged by, and the bar each must reach to ship. */
export const MEASURES = [
  { key: 'visitCorrect', bar: 0.9 },
  { key: 'dartCorrect', bar: 0.95 },
  { key: 'boardFound', bar: 0.98 },
] as const;
export type MeasureKey = (typeof MEASURES)[number]['key'];

export interface ModelScores {
  id: number;
  name: string;
  status: 'candidate' | 'active' | 'retired';
  runId: number;
  createdAt: number;
  evaluatedOn: string | null;
  samples: number | null;
  visitCorrect: number | null;
  dartCorrect: number | null;
  boardFound: number | null;
  exported: boolean;
}

export interface PrefillStats {
  model: string;
  visits: number;
  accepted: number;
}

export interface Overview {
  counts: {
    captures: number;
    sessions: number;
    toReview: number;
    valuesOnly: number;
    rejected: number;
    bySplit: { train: number; val: number; test: number };
  };
  active: ModelScores | null;
  progress: { name: string; visitCorrect: number; dartCorrect: number; boardFound: number }[];
  coverage: {
    key: string;
    title: string;
    buckets: { bucket: string; training: number; verify: number; thin: boolean }[];
  }[];
  prefill: PrefillStats[];
}

export interface Models {
  models: ModelScores[];
  prefill: PrefillStats[];
  testPhotos: number;
}

export interface RunSummary {
  id: number;
  kind: 'train' | 'verify';
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  stage: string | null;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  error: string | null;
  baseModel: string | null;
  /** The model a training run made. */
  model: string | null;
  /** A verification's models, by name. */
  models?: string[];
  visitCorrect: number | null;
  dartCorrect: number | null;
  boardFound: number | null;
  /** Where its check ran ("verify set, snapshot 7") and on how many photos. */
  evaluatedOn: string | null;
  samples: number | null;
  /** The photos it trained, validated and was checked on. */
  snapshot: { train: number; val: number; test: number } | null;
  params: {
    epochs?: number;
    from?: 'scratch' | 'model';
    baseModelId?: number;
    modelIds?: number[];
    deepdarts?: boolean;
    captures?: boolean;
    lr?: number;
    batch?: number;
    captureWeight?: number;
    deepdartsSample?: number;
  };
}

export interface EpochMetrics {
  epoch: number;
  visit_correct: number;
  dart_correct: number;
  board_found: number;
  loss: number;
  val_loss: number;
  seconds: number;
  images_per_second?: number;
  /** The checkpoint kept (best validation visit so far). */
  best?: boolean;
}

/** A past run's model and the one it started from (Lab's runComparison). */
export interface RunComparison {
  made: { id: number; name: string; status: ModelScores['status'] } | null;
  base: {
    id: number;
    name: string;
    visitCorrect: number | null;
    dartCorrect: number | null;
    boardFound: number | null;
    /** On the same verify photos as the run's own check. */
    sameSnapshot: boolean;
  } | null;
}

export interface RunDetail {
  run: RunSummary;
  metrics: EpochMetrics[];
  log: { tail?: string; step: { epoch: number; step: number; of: number } | null };
  comparison?: RunComparison | null;
}

/** The epoch whose checkpoint was kept: marked by Lab, else the best validation visit. */
export function bestEpoch(metrics: EpochMetrics[]): EpochMetrics | null {
  const marked = metrics.filter((m) => m.best).at(-1);
  if (marked) return marked;
  return metrics.reduce<EpochMetrics | null>(
    (b, m) => (!b || m.visit_correct > b.visit_correct ? m : b),
    null,
  );
}

/** The sessions Lab has, by ID (to say which of the phone's aren't there). */
export const fetchLabSessions = (url: string, f?: typeof fetch) =>
  call<{ ids: string[] }>(url, '/api/sessions', undefined, f);

/** Where Lab's captures stand, by ID (labelled, values-only, unlabelled, rejected). */
export const fetchCaptureStates = (url: string, ids: string[], f?: typeof fetch) =>
  call<{ states: Record<string, string> }>(
    url,
    '/api/captures/states',
    { ...post, body: JSON.stringify({ ids }) },
    f,
  );

export const fetchOverview = (url: string, f?: typeof fetch) =>
  call<Overview>(url, '/api/overview', undefined, f);
export const fetchModels = (url: string, f?: typeof fetch) =>
  call<Models>(url, '/api/models', undefined, f);
export const fetchRuns = (url: string, f?: typeof fetch) =>
  call<RunSummary[]>(url, '/api/runs', undefined, f);
export const fetchRun = (url: string, id: number, f?: typeof fetch) =>
  call<RunDetail>(url, `/api/runs/${id}`, undefined, f);

export const activateModel = (url: string, id: number, f?: typeof fetch) =>
  call<unknown>(url, `/api/models/${id}/activate`, post, f);
export const verifyModels = (url: string, modelIds: number[], f?: typeof fetch) =>
  call<RunSummary>(
    url,
    '/api/runs',
    { ...post, body: JSON.stringify({ kind: 'verify', modelIds }) },
    f,
  );
/** Fine-tunes a model with Lab's usual settings for that (its Runs form's defaults). */
export const fineTune = (url: string, baseModelId: number, f?: typeof fetch) =>
  call<RunSummary>(
    url,
    '/api/runs',
    { ...post, body: JSON.stringify({ from: 'model', baseModelId }) },
    f,
  );
export const cancelRun = (url: string, id: number, f?: typeof fetch) =>
  call<unknown>(url, `/api/runs/${id}/cancel`, post, f);

export const isLive = (r: RunSummary) => r.status === 'queued' || r.status === 'running';

/** How far a training run has got, 0–1: finished epochs plus the share of the current one. */
export function runProgress(d: RunDetail): number {
  const epochs = d.run.params.epochs ?? 1;
  if (d.run.status === 'done') return 1;
  const done = d.metrics.length;
  const step = d.log.step;
  const part = d.run.stage === 'train' && step && step.epoch === done + 1 ? step.step / step.of : 0;
  return Math.min(1, (done + part) / epochs);
}

/** A candidate that beats the active model on all three numbers, newest first. */
export function betterCandidate(models: ModelScores[]): ModelScores | null {
  const active = models.find((m) => m.status === 'active');
  return (
    models.find(
      (m) =>
        m.status === 'candidate' &&
        MEASURES.every((x) => m[x.key] != null && (!active || m[x.key]! > (active[x.key] ?? 0))),
    ) ?? null
  );
}
