// The run's Live Activity on the phone (capture-lab.md › Live Activity; ADR 0013). When a run
// starts, Lab starts a Live Activity on every phone that sent a push-to-start token; the phone
// then sends that activity's own token, and Lab updates it as the run goes (each stage change,
// and every minute while it trains) and ends it with the result. All of it goes through Apple's
// push service, so nothing happens unless lab/.env.local has the APNs key (README).
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';

import { RUN_ACTIVITY, type ActivityColors, type RunActivityProps } from '@domain/lab/runActivity';

import { apnsConfig, apnsSender, isDeadToken, type ApnsSender } from './apns';
import { db } from './db/client';
import { liveActivityTokens, runs } from './db/schema';
import { getRun, type RunSummary } from './runs';

/** The Live Activity's name in TU Capture (`createLiveActivity('RunActivity', …)`). */
export const ACTIVITY_NAME = RUN_ACTIVITY;
export type { ActivityColors, RunActivityProps };

const pct = (x: number | null) => (x === null ? '–' : `${Math.round(x * 100)}%`);

/** "Verifying v6 (1 of 2)" lines in the log: which model a verification run is on. */
function verifyStep(tail: string): { k: number; n: number; name: string } | null {
  const lines = tail.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = /^Verifying (\S+) \((\d+) of (\d+)\)/.exec(lines[i]!);
    if (m) return { name: m[1]!, k: Number(m[2]), n: Number(m[3]) };
  }
  return null;
}

/** The Live Activity's content for a run, from what the Run page shows. */
export function activityProps(
  detail: NonNullable<ReturnType<typeof getRun>>,
  now: number,
  colors: ActivityColors | null,
): RunActivityProps {
  const { run, metrics, log } = detail;
  const base = {
    runId: run.id,
    kind: run.kind,
    status: run.status,
    startedAt: run.startedAt,
    url: `tonupcapture://runs/${run.id}`,
    colors,
  };
  const result =
    run.visitCorrect !== null
      ? `Visits ${pct(run.visitCorrect)} · darts ${pct(run.dartCorrect)} · board ${pct(run.boardFound)}`
      : null;

  if (run.kind === 'verify') {
    const names = run.models.join(', ');
    const step = verifyStep(log.tail);
    const title = `Verifying ${names}`;
    if (run.status === 'queued')
      return { ...base, title, line: 'Waiting to start', result: null, progress: 0, endsAt: null };
    if (run.status === 'running') {
      const line =
        run.stage === 'snapshot' || !step
          ? 'Taking a snapshot of the verify set'
          : `${step.name}: model ${step.k} of ${step.n}`;
      return {
        ...base,
        title,
        line,
        result: null,
        progress: step ? (step.k - 1) / step.n : 0,
        endsAt: null,
      };
    }
    return {
      ...base,
      title,
      line: ended(run),
      result: run.status === 'done' ? (result ?? 'Results on the Verify page') : null,
      progress: run.status === 'done' ? 1 : null,
      endsAt: null,
    };
  }

  const p = run.params;
  const title =
    p.from === 'model' && run.baseModel ? `Fine-tuning ${run.baseModel}` : 'Training from scratch';
  if (run.status === 'queued')
    return { ...base, title, line: 'Waiting to start', result: null, progress: 0, endsAt: null };
  if (run.status !== 'running') {
    return {
      ...base,
      title,
      line: ended(run),
      result: run.status === 'done' ? result : null,
      progress: run.status === 'done' ? 1 : null,
      endsAt: null,
    };
  }
  const epochs = p.epochs ?? 1;
  const done = metrics.length;
  const step = log.step;
  const part = run.stage === 'train' && step && step.epoch === done + 1 ? step.step / step.of : 0;
  const trained = Math.min(1, (done + part) / epochs);
  // Training is most of a run; evaluating and exporting after it take a few minutes.
  const progress =
    run.stage === 'evaluate'
      ? 0.93
      : run.stage === 'export'
        ? 0.97
        : run.stage === 'train'
          ? trained * 0.9
          : 0;
  const elapsed = run.startedAt ? now - run.startedAt : 0;
  const endsAt =
    run.stage === 'train' && run.startedAt && trained >= 0.02
      ? Math.round(run.startedAt + (elapsed / trained) * 1.05)
      : null;
  const last = metrics[metrics.length - 1];
  const line =
    run.stage === 'snapshot'
      ? 'Taking a snapshot of the labels'
      : run.stage === 'evaluate'
        ? 'Checking the best epoch on the verify set'
        : run.stage === 'export'
          ? 'Exporting for the phone'
          : `Epoch ${Math.min(done + 1, epochs)} of ${epochs}`;
  return {
    ...base,
    title,
    line,
    // The best so far, while it trains.
    result: last
      ? `Best so far: visits ${pct(Math.max(...metrics.map((m) => m.visit_correct)))}`
      : null,
    progress,
    endsAt,
  };
}

function ended(run: RunSummary): string {
  if (run.status === 'cancelled') return 'Cancelled';
  if (run.status === 'failed') return `Failed: ${run.error ?? 'see the log'}`;
  if (run.kind === 'train') return run.model ? `${run.model} is a candidate` : 'Done';
  return 'Done';
}

// ── Sending ──────────────────────────────────────────────────────────────────────────────

const g = globalThis as unknown as {
  labLive?: { sender: ApnsSender | null | undefined; lastPush: Map<number, number> };
};
const state = () => (g.labLive ??= { sender: undefined, lastPush: new Map() });

function sender(): ApnsSender | null {
  const s = state();
  if (s.sender === undefined) {
    const c = apnsConfig();
    s.sender = c ? apnsSender(c) : null;
  }
  return s.sender;
}

/** Tests only: send through this instead of APNs (null turns pushes off). */
export function setSenderForTests(fn: ApnsSender | null | undefined) {
  state().sender = fn;
  state().lastPush.clear();
}

type TokenRow = typeof liveActivityTokens.$inferSelect;

const colorsOf = (row: TokenRow): ActivityColors | null => {
  try {
    return row.colors ? (JSON.parse(row.colors) as ActivityColors) : null;
  } catch {
    return null;
  }
};

const payload = (event: 'start' | 'update' | 'end', props: RunActivityProps, now: number) => ({
  timestamp: Math.floor(now / 1000),
  event,
  'content-state': { name: ACTIVITY_NAME, props: JSON.stringify(props) },
  // Shown as out of date if Lab goes quiet for ten minutes mid-run.
  ...(event !== 'end' ? { 'stale-date': Math.floor(now / 1000) + 600 } : {}),
});

async function send(row: TokenRow, body: object, priority: 5 | 10) {
  const push = sender();
  if (!push) return;
  const r = await push(row.token, { aps: body }, { priority });
  const d = db();
  if (r.status === 200) {
    if (row.lastError)
      d.update(liveActivityTokens)
        .set({ lastError: null })
        .where(eq(liveActivityTokens.id, row.id))
        .run();
  } else if (isDeadToken(r)) {
    d.delete(liveActivityTokens).where(eq(liveActivityTokens.id, row.id)).run();
  } else {
    d.update(liveActivityTokens)
      .set({ lastError: `${r.status} ${r.reason ?? ''}`.trim() })
      .where(eq(liveActivityTokens.id, row.id))
      .run();
  }
}

const activitiesFor = (runId: number) =>
  db()
    .select()
    .from(liveActivityTokens)
    .where(
      and(
        eq(liveActivityTokens.kind, 'activity'),
        eq(liveActivityTokens.runId, runId),
        isNull(liveActivityTokens.endedAt),
      ),
    )
    .all();

/** A run started: start its Live Activity on each phone that can be started remotely. */
export async function runStarted(runId: number, now = Date.now()) {
  if (!sender()) return;
  const detail = getRun(runId);
  if (!detail) return;
  const starts = db()
    .select()
    .from(liveActivityTokens)
    .where(eq(liveActivityTokens.kind, 'start'))
    .all();
  for (const row of starts) {
    const props = activityProps(detail, now, colorsOf(row));
    await send(
      row,
      {
        ...payload('start', props, now),
        'attributes-type': 'LiveActivityAttributes',
        attributes: { url: props.url },
        alert: { title: props.title, body: props.line },
        // iOS 18: hand the new activity its own update token straight away.
        'input-push-token': 1,
      },
      10,
    );
  }
  state().lastPush.set(runId, now);
}

/**
 * Brings the run's Live Activities up to date. `important` (a stage change) goes now at high
 * priority; otherwise at most once a minute, at the low priority Apple doesn't ration as hard.
 */
export async function runProgress(runId: number, important = false, now = Date.now()) {
  if (!sender()) return;
  const last = state().lastPush.get(runId) ?? 0;
  if (!important && now - last < 60_000) return;
  const rows = activitiesFor(runId);
  if (!rows.length) return;
  const detail = getRun(runId);
  if (!detail) return;
  state().lastPush.set(runId, now);
  for (const row of rows) {
    await send(
      row,
      payload('update', activityProps(detail, now, colorsOf(row)), now),
      important ? 10 : 5,
    );
  }
}

/** The run finished, failed or was cancelled: end its Live Activities with how it went. */
export async function runEnded(runId: number, now = Date.now()) {
  if (!sender()) return;
  const detail = getRun(runId);
  const rows = activitiesFor(runId);
  if (!detail || !rows.length) return;
  for (const row of rows) {
    await send(
      row,
      {
        ...payload('end', activityProps(detail, now, colorsOf(row)), now),
        // Stays on the Lock Screen for an hour, then goes.
        'dismissal-date': Math.floor(now / 1000) + 3600,
      },
      10,
    );
  }
  db()
    .update(liveActivityTokens)
    .set({ endedAt: new Date(now) })
    .where(
      inArray(
        liveActivityTokens.id,
        rows.map((r) => r.id),
      ),
    )
    .run();
  state().lastPush.delete(runId);
}

// ── Tokens from the phone ────────────────────────────────────────────────────────────────

/** The run a new Live Activity belongs to: the one going now, else one that just ended. */
function runForNewActivity(now: number): number | null {
  const d = db();
  const live = d
    .select({ id: runs.id })
    .from(runs)
    .where(inArray(runs.status, ['running', 'queued']))
    .orderBy(desc(runs.id))
    .get();
  if (live) return live.id;
  const recent = d
    .select({ id: runs.id, endedAt: runs.endedAt })
    .from(runs)
    .orderBy(desc(runs.id))
    .get();
  return recent?.endedAt && now - recent.endedAt.getTime() < 10 * 60_000 ? recent.id : null;
}

export interface TokenInput {
  kind: 'start' | 'activity';
  token: string;
  activityId?: string;
  colors?: ActivityColors;
}

/**
 * Records a token from the phone. An activity token is matched to its run, and gets the run's
 * current state straight away (or its end, if the run is over).
 */
export async function registerToken(input: TokenInput, now = Date.now()) {
  const d = db();
  const colors = input.colors ? JSON.stringify(input.colors) : null;
  const same = d
    .select()
    .from(liveActivityTokens)
    .where(eq(liveActivityTokens.token, input.token))
    .get();
  // An activity's token can change; it's the same activity.
  const byActivity =
    input.kind === 'activity' && input.activityId
      ? d
          .select()
          .from(liveActivityTokens)
          .where(eq(liveActivityTokens.activityId, input.activityId))
          .get()
      : undefined;
  const existing = same ?? byActivity;
  let row: TokenRow;
  if (existing) {
    row = d
      .update(liveActivityTokens)
      .set({ token: input.token, colors: colors ?? existing.colors, lastError: null })
      .where(eq(liveActivityTokens.id, existing.id))
      .returning()
      .get();
  } else {
    if (input.kind === 'start') {
      // One start token per phone: a new one replaces the old.
      d.delete(liveActivityTokens).where(eq(liveActivityTokens.kind, 'start')).run();
    }
    row = d
      .insert(liveActivityTokens)
      .values({
        kind: input.kind,
        token: input.token,
        activityId: input.activityId ?? null,
        runId: input.kind === 'activity' ? runForNewActivity(now) : null,
        colors,
        createdAt: new Date(now),
      })
      .returning()
      .get();
  }
  if (row.kind === 'activity' && row.runId !== null && !row.endedAt) {
    const run = d.select({ status: runs.status }).from(runs).where(eq(runs.id, row.runId)).get();
    if (run && (run.status === 'running' || run.status === 'queued')) {
      const detail = getRun(row.runId);
      if (detail)
        await send(row, payload('update', activityProps(detail, now, colorsOf(row)), now), 10);
    } else {
      await runEnded(row.runId, now);
    }
  }
  return { id: row.id, runId: row.runId };
}

/** For the Runs page: whether push is set up and whether a phone has signed up. */
export function liveActivityStatus() {
  const config = apnsConfig();
  const rows = db().select().from(liveActivityTokens).all();
  return {
    configured: !!config,
    sandbox: config?.sandbox ?? true,
    phone: rows.some((r) => r.kind === 'start'),
    showing: rows.filter((r) => r.kind === 'activity' && !r.endedAt).length,
    lastError: rows.find((r) => r.lastError)?.lastError ?? null,
  };
}
