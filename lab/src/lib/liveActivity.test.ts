import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apnsConfig, isDeadToken, providerToken, type ApnsSender } from './apns';
import { closeDbForTests, db } from './db/client';
import { liveActivityTokens, runs } from './db/schema';
import {
  activityProps,
  registerToken,
  runEnded,
  runProgress,
  runStarted,
  setSenderForTests,
} from './liveActivity';
import { createTrainRun, DEFAULTS, getRun, runDir } from './runs';

const START = 'a'.repeat(64);
const ACT = 'b'.repeat(64);

let sent: { token: string; aps: Record<string, unknown>; priority: number }[];
let answer: { status: number; reason?: string };
const fake: ApnsSender = async (token, payload, { priority }) => {
  sent.push({ token, aps: (payload as { aps: Record<string, unknown> }).aps, priority });
  return answer;
};
const propsOf = (aps: Record<string, unknown>) =>
  JSON.parse((aps['content-state'] as { props: string }).props) as ReturnType<typeof activityProps>;

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-live-'));
  process.env.TONUP_LAB_DATA = dir;
  closeDbForTests();
  sent = [];
  answer = { status: 200 };
  setSenderForTests(fake);
});
afterEach(() => {
  setSenderForTests(undefined);
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A training run, running since `started`, with `epochs` done and a step into the next. */
function trainingRun(started: number, done: number, step?: [number, number]) {
  const { id } = createTrainRun({ ...DEFAULTS.scratch, from: 'scratch', epochs: 10 });
  db()
    .update(runs)
    .set({ status: 'running', stage: 'train', startedAt: new Date(started) })
    .where(eq(runs.id, id))
    .run();
  fs.mkdirSync(runDir(id), { recursive: true });
  const metrics = Array.from({ length: done }, (_, i) => ({
    epoch: i + 1,
    epochs: 10,
    loss: 1,
    val_loss: 1,
    visit_correct: 0.5 + i / 20,
    dart_correct: 0.8,
    board_found: 0.9,
    seconds: 60,
    best: true,
  }));
  fs.writeFileSync(
    path.join(runDir(id), 'metrics.jsonl'),
    metrics.map((m) => JSON.stringify(m)).join('\n'),
  );
  fs.writeFileSync(
    path.join(runDir(id), 'log.txt'),
    step ? `epoch ${done + 1} step ${step[0]}/${step[1]}\n` : '',
  );
  return id;
}

describe('what the Live Activity shows', () => {
  it('a training run: the epoch, how far it has got and when it should finish', () => {
    const now = 1_000_000_000_000;
    const id = trainingRun(now - 20 * 60_000, 2, [50, 100]);
    const p = activityProps(getRun(id)!, now, null);
    expect(p.title).toBe('Training from scratch');
    expect(p.line).toBe('Epoch 3 of 10');
    expect(p.progress).toBeCloseTo(0.25 * 0.9);
    // 25% in 20 minutes: about 80 more, with a little for evaluating and exporting.
    expect(p.endsAt).toBe(Math.round(now - 20 * 60_000 + 80 * 60_000 * 1.05));
    expect(p.result).toBe('Best so far: visits 55%');
    expect(p.url).toBe(`tonupcapture://runs/${id}`);
  });

  it('a finished run: the model it made and its numbers', () => {
    const id = trainingRun(0, 10);
    db()
      .update(runs)
      .set({ status: 'done', stage: null, visitCorrect: 0.91, dartCorrect: 0.96, boardFound: 0.99 })
      .where(eq(runs.id, id))
      .run();
    const p = activityProps(getRun(id)!, 0, null);
    expect(p.line).toBe('Done');
    expect(p.result).toBe('Visits 91% · darts 96% · board 99%');
    expect(p.progress).toBe(1);
  });

  it('a failed run says why', () => {
    const id = trainingRun(0, 1);
    db()
      .update(runs)
      .set({ status: 'failed', stage: null, error: 'No training data' })
      .where(eq(runs.id, id))
      .run();
    expect(activityProps(getRun(id)!, 0, null).line).toBe('Failed: No training data');
  });
});

describe('pushes', () => {
  it('starts a Live Activity on the phone when a run starts', async () => {
    await registerToken({ kind: 'start', token: START });
    const id = trainingRun(Date.now(), 0);
    await runStarted(id);
    expect(sent).toHaveLength(1);
    const { aps, token, priority } = sent[0]!;
    expect(token).toBe(START);
    expect(priority).toBe(10);
    expect(aps.event).toBe('start');
    expect(aps['attributes-type']).toBe('LiveActivityAttributes');
    expect(aps.attributes).toEqual({ url: `tonupcapture://runs/${id}` });
    expect((aps['content-state'] as { name: string }).name).toBe('RunActivity');
    expect(propsOf(aps).title).toBe('Training from scratch');
  });

  it('keeps one start token, the newest', async () => {
    await registerToken({ kind: 'start', token: START });
    await registerToken({ kind: 'start', token: 'c'.repeat(64) });
    const rows = db().select().from(liveActivityTokens).all();
    expect(rows.map((r) => r.token)).toEqual(['c'.repeat(64)]);
  });

  it('matches a new activity to the run going now and updates it at once', async () => {
    const id = trainingRun(Date.now(), 1);
    const r = await registerToken({ kind: 'activity', token: ACT, activityId: 'A1' });
    expect(r.runId).toBe(id);
    expect(sent.map((s) => s.aps.event)).toEqual(['update']);
  });

  it('updates at most once a minute, but a new stage goes straight away', async () => {
    const id = trainingRun(Date.now(), 1);
    await registerToken({ kind: 'activity', token: ACT, activityId: 'A1' });
    sent = [];
    const t = Date.now();
    await runProgress(id, false, t);
    await runProgress(id, false, t + 30_000);
    await runProgress(id, true, t + 31_000);
    await runProgress(id, false, t + 95_000);
    expect(sent.map((s) => s.priority)).toEqual([5, 10, 5]);
  });

  it('ends it with the result, and sends nothing after', async () => {
    const id = trainingRun(Date.now(), 1);
    await registerToken({ kind: 'activity', token: ACT, activityId: 'A1' });
    db().update(runs).set({ status: 'done', stage: null }).where(eq(runs.id, id)).run();
    sent = [];
    await runEnded(id);
    expect(sent[0]!.aps.event).toBe('end');
    expect(sent[0]!.aps['dismissal-date']).toBeTypeOf('number');
    sent = [];
    await runProgress(id, true);
    expect(sent).toEqual([]);
  });

  it('ends a Live Activity that turns up after its run finished', async () => {
    const id = trainingRun(Date.now(), 1);
    db()
      .update(runs)
      .set({ status: 'done', stage: null, endedAt: new Date() })
      .where(eq(runs.id, id))
      .run();
    await registerToken({ kind: 'activity', token: ACT, activityId: 'A1' });
    expect(sent.map((s) => s.aps.event)).toEqual(['end']);
  });

  it('drops a token Apple no longer accepts', async () => {
    await registerToken({ kind: 'start', token: START });
    answer = { status: 410, reason: 'Unregistered' };
    await runStarted(trainingRun(Date.now(), 0));
    expect(db().select().from(liveActivityTokens).all()).toEqual([]);
  });

  it('does nothing without push set up', async () => {
    setSenderForTests(null);
    await registerToken({ kind: 'start', token: START });
    await runStarted(trainingRun(Date.now(), 0));
    expect(sent).toEqual([]);
  });
});

describe('APNs', () => {
  it('signs the provider token with the key, as ES256', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const c = { keyFile: '', keyId: 'KEY123', teamId: 'TEAM45', bundleId: 'b', sandbox: true };
    const jwt = providerToken(c, 1_700_000_000_000, pem);
    const [h, claims, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({
      alg: 'ES256',
      kid: 'KEY123',
    });
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toEqual({
      iss: 'TEAM45',
      iat: 1_700_000_000,
    });
    const ok = crypto.verify(
      'sha256',
      Buffer.from(`${h}.${claims}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig!, 'base64url'),
    );
    expect(ok).toBe(true);
  });

  it('reads its settings from the environment, sandbox unless told otherwise', () => {
    expect(apnsConfig({})).toBeNull();
    const c = apnsConfig({
      TONUP_APNS_KEY: 'k.p8',
      TONUP_APNS_KEY_ID: 'K',
      TONUP_APNS_TEAM_ID: 'T',
    });
    expect(c).toMatchObject({ bundleId: 'com.perchedchicken.tonup.capture', sandbox: true });
    expect(
      apnsConfig({
        TONUP_APNS_KEY: 'k.p8',
        TONUP_APNS_KEY_ID: 'K',
        TONUP_APNS_TEAM_ID: 'T',
        TONUP_APNS_ENV: 'production',
      })!.sandbox,
    ).toBe(false);
  });

  it('knows which answers mean the token is gone', () => {
    expect(isDeadToken({ status: 410 })).toBe(true);
    expect(isDeadToken({ status: 400, reason: 'BadDeviceToken' })).toBe(true);
    expect(isDeadToken({ status: 429, reason: 'TooManyRequests' })).toBe(false);
  });
});
