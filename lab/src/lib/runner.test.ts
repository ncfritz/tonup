import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { boardPointOf, CALIBRATION_IDS } from '@domain/camera';
import { polar } from '@domain/board';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDbForTests } from './db/client';
import { ingestCapture } from './ingest';
import { cancelRun, idleForTests, recoverRuns, tick } from './runner';
import { activateModel, activeModel, createTrainRun, DEFAULTS, getRun, listModels } from './runs';
import { splitOf } from './splits';

const toImage = (p: { x: number; y: number }) => ({
  x: 0.5 + (p.x / 170) * 0.3,
  y: 0.5 - (p.y / 170) * 0.3,
});
const fake = path.join(__dirname, '__fixtures__', 'fake-python.mjs');

let dir: string;
let calls: string;
beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-runner-'));
  calls = path.join(dir, 'calls.txt');
  fs.writeFileSync(calls, '');
  Object.assign(process.env, {
    TONUP_LAB_DATA: path.join(dir, 'data'),
    TONUP_LAB_PYTHON: fake,
    TONUP_REPO: path.resolve(__dirname, '../../..'),
    FAKE_CALLS: calls,
  });
  delete process.env.FAKE_FAIL;
  delete process.env.FAKE_SLOW;
  closeDbForTests();
  const photo = await sharp({
    create: { width: 40, height: 30, channels: 3, background: '#556677' },
  })
    .jpeg()
    .toBuffer();
  // One session in the train set, one in the verify set (and one values-only visit there).
  expect([splitOf('session-a'), splitOf('x')]).toEqual(['train', 'test']);
  let n = 0;
  for (const [sessionId, valuesOnly] of [
    ['session-a', false],
    ['session-a', false],
    ['x', false],
    ['x', true],
  ] as const) {
    n++;
    await ingestCapture(
      {
        id: `c${n}`,
        image: `c${n}.jpg`,
        width: 40,
        height: 30,
        createdAt: `2026-11-04T05:0${n}:00Z`,
        sessionId,
        valuesOnly,
        calibration: CALIBRATION_IDS.map((id) => toImage(boardPointOf(id))),
        darts: [{ ...toImage(polar(103, 0)), value: 'T20' }],
      },
      photo,
      'phone',
    );
  }
});
afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

const params = (over: object = {}) => ({
  from: 'scratch' as const,
  ...DEFAULTS.scratch,
  deepdarts: false,
  epochs: 3,
  ...over,
});
const log = () => fs.readFileSync(calls, 'utf8').trim().split('\n');

describe('the runner', () => {
  it('snapshots, trains, verifies, exports and registers a candidate', async () => {
    const run = createTrainRun(params());
    tick();
    await idleForTests();
    const { run: done, metrics } = getRun(run.id)!;
    expect(done.status).toBe('done');
    expect(done.snapshot).toEqual({ train: 2, val: 0, test: 2 });
    expect(metrics.map((m) => m.epoch)).toEqual([1, 2, 3]);
    expect(done).toMatchObject({
      evaluatedOn: expect.stringContaining('verify set'),
      samples: 2,
      visitCorrect: 0.5,
    });
    expect(log().map((l) => l.split(' ')[0])).toEqual([
      'tonup_ml.train',
      'tonup_ml.evaluate',
      'tonup_ml.export',
    ]);
    expect(log()[0]).toContain('--epochs 3');
    expect(log()[0]).not.toContain('--deepdarts ');

    const [model] = listModels();
    expect(model).toMatchObject({
      name: 'v1',
      status: 'candidate',
      runId: run.id,
      visitCorrect: 0.5,
    });
    expect(fs.existsSync(path.join(dir, 'data', model!.mlpackage!, 'Manifest.json'))).toBe(true);

    // The snapshot holds the labels as ml/ reads them, split included.
    const snapDir = path.join(dir, 'data', 'snapshots', '1');
    const label = JSON.parse(fs.readFileSync(path.join(snapDir, 'c3.json'), 'utf8'));
    expect(label).toMatchObject({
      image: 'c3.jpg',
      sessionId: 'x',
      split: 'test',
      valuesOnly: false,
    });
    expect(label.calibration).toHaveLength(5);
    expect(fs.existsSync(path.join(snapDir, 'c3.jpg'))).toBe(true);
  });

  it('fine-tunes from a model’s checkpoint', async () => {
    createTrainRun(params());
    tick();
    await idleForTests();
    const v1 = listModels()[0]!;
    createTrainRun(params({ from: 'model', baseModelId: v1.id }));
    tick();
    await idleForTests();
    const train = log().filter((l) => l.startsWith('tonup_ml.train'))[1]!;
    expect(train).toContain(`--resume ${path.join(dir, 'data', 'runs', '1', 'best.pt')}`);
    expect(listModels().map((m) => m.name)).toEqual(['v2', 'v1']);
  });

  it('records a failed step and goes on to the next queued run', async () => {
    process.env.FAKE_FAIL = 'tonup_ml.evaluate';
    const a = createTrainRun(params());
    const b = createTrainRun(params());
    tick();
    await idleForTests();
    expect(getRun(a.id)!.run).toMatchObject({
      status: 'failed',
      error: expect.stringContaining('exited with 3'),
    });
    expect(getRun(a.id)!.log.tail).toContain('Traceback');
    expect(getRun(b.id)!.run.status).toBe('failed');
    expect(listModels()).toEqual([]);
  });

  it('cancels a running run', async () => {
    process.env.FAKE_SLOW = '5000';
    const run = createTrainRun(params());
    tick();
    await new Promise((r) => setTimeout(r, 300));
    expect(getRun(run.id)!.run.status).toBe('running');
    expect(cancelRun(run.id)).toBe(true);
    await idleForTests();
    expect(getRun(run.id)!.run.status).toBe('cancelled');
  });

  it('refuses DeepDarts without its folder, and marks runs left running as failed', async () => {
    const run = createTrainRun(params({ deepdarts: true }));
    tick();
    await idleForTests();
    expect(getRun(run.id)!.run.error).toMatch(/DeepDarts/);
    recoverRuns();
  });
});

describe('models', () => {
  it('has one active model at a time', async () => {
    createTrainRun(params());
    createTrainRun(params());
    tick();
    await idleForTests();
    const [v2, v1] = listModels();
    activateModel(v1!.id);
    activateModel(v2!.id);
    expect(activeModel()?.name).toBe('v2');
    expect(listModels().map((m) => m.status)).toEqual(['active', 'retired']);
  });
});
