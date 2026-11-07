import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { polar } from '@domain/board';
import { boardPointOf, CALIBRATION_IDS } from '@domain/camera';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDbForTests, db } from './db/client';
import { models, reads } from './db/schema';
import { confirmCorrected, ingestCapture } from './ingest';
import type { LabelInput } from './labels';
import { BLIND_DISAGREED, READ_FIXED } from './prefill';
import { getCapture, listCaptures } from './queries';
import {
  blindAgreement,
  checkRead,
  readsSettings,
  sameValues,
  sessionPlan,
  setReadsSettings,
} from './reads';
import { splitOf } from './splits';

// A board square on in a 400 × 300 photo.
const toImage = (p: { x: number; y: number }) => ({
  x: 0.5 + (p.x / 170) * 0.3,
  y: 0.5 - (p.y / 170) * 0.4,
});
const calibration = CALIBRATION_IDS.map((id) => toImage(boardPointOf(id)));
const points = Object.fromEntries(CALIBRATION_IDS.map((id, i) => [id, calibration[i]!]));
const T20 = toImage(polar(103, 0));
const S5 = toImage(polar(130, -18));
const S1 = toImage(polar(70, 18));

const label = (darts: LabelInput['darts']): LabelInput => ({ points, darts, missed: 0 });
const read = (value: string, tip: { x: number; y: number }, sure = true) => ({ value, sure, tip });

describe('checkRead', () => {
  const asRead = [read('T20', T20), read('5', S5), read('1', S1)];
  it('confirms a label saved as read, whatever order the darts are in', () => {
    const c = checkRead(
      asRead,
      label([
        { entered: '1', tip: S1, onWire: false },
        { entered: 'T20', tip: T20, onWire: false },
        { entered: '5', tip: S5, onWire: false },
      ]),
      true,
    );
    expect(c.outcome).toBe('confirmed');
  });
  it('counts a changed value, a moved tip, a wire and a changed board as fixes', () => {
    const moved = toImage(polar(103, 4));
    const c = checkRead(
      asRead,
      label([
        { entered: 'T20', tip: moved, onWire: false },
        { entered: '20', tip: S5, onWire: true },
        { entered: '1', tip: S1, onWire: false },
      ]),
      true,
    );
    expect(c).toMatchObject({ outcome: 'fixed', valuesChanged: 1, tipsMoved: 1, wiresMarked: 1 });
    expect(
      checkRead(
        asRead,
        label(asRead.map((r) => ({ entered: r.value, tip: r.tip, onWire: false }))),
        false,
      ).outcome,
    ).toBe('fixed');
  });
  it('counts a dart taken away, one added, and one that became a bounce-out', () => {
    const away = checkRead(
      asRead,
      label([
        { entered: 'T20', tip: T20, onWire: false },
        { entered: '5', tip: S5, onWire: false },
      ]),
      true,
    );
    expect(away).toMatchObject({ dartsRemoved: 1, dartsAdded: 0, valuesChanged: 0 });
    const added = checkRead(
      asRead.slice(0, 2),
      label([
        { entered: 'T20', tip: T20, onWire: false },
        { entered: '5', tip: S5, onWire: false },
        { entered: '1', tip: S1, onWire: false },
      ]),
      true,
    );
    expect(added).toMatchObject({ dartsAdded: 1, dartsRemoved: 0 });
    const bounced = checkRead(
      asRead,
      label([
        { entered: 'T20', tip: T20, onWire: false },
        { entered: '5', tip: S5, onWire: false },
        { entered: 'Bounce-out', tip: null, onWire: false },
      ]),
      true,
    );
    expect(bounced).toMatchObject({ dartsRemoved: 0, valuesChanged: 1 });
  });
});

describe('sameValues', () => {
  it('ignores order and spelling', () => {
    expect(sameValues(['T20', '5', '1'], ['1', 't20', 'S5'])).toBe(true);
    expect(sameValues(['T20', '5', '1'], ['T20', '20', '1'])).toBe(false);
  });
});

// Session IDs whose hash puts them in each set.
const idIn = (split: 'train' | 'val' | 'test') => {
  for (let i = 0; ; i++) if (splitOf(`s${i}`) === split) return `s${i}`;
};

const jpeg = () =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: '#556677' } })
    .jpeg()
    .toBuffer();

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-reads-'));
  process.env.TONUP_LAB_DATA = path.join(dir, 'data');
  closeDbForTests();
});
afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

const activate = (visitCorrect: number) =>
  db()
    .insert(models)
    .values({
      name: 'v6',
      runId: 1,
      status: 'active',
      createdAt: new Date(),
      checkpoint: 'runs/1/best.pt',
      evaluatedOn: 'verify set (snapshot 1)',
      samples: 100,
      visitCorrect,
      dartCorrect: 0.96,
      boardFound: 0.99,
    })
    .run();

describe('sessionPlan', () => {
  it('reads only training sessions, with the setting on and the active model at the bar', () => {
    const train = idIn('train');
    expect(sessionPlan(train).reads).toMatchObject({ on: false, why: 'off in Lab' });
    expect(readsSettings()).toEqual({ mode: 'off', every: 10 });
    setReadsSettings({ mode: 'train', every: 8 });
    expect(sessionPlan(train).reads.why).toBe('no active model');
    activate(0.85);
    expect(sessionPlan(train).reads.why).toMatch(/below the 90% visit bar/);
    db().update(models).set({ visitCorrect: 0.92 }).run();
    expect(sessionPlan(train)).toEqual({
      sessionId: train,
      split: 'train',
      reads: { on: true, every: 8, model: 'v6', why: 'on' },
    });
    expect(sessionPlan(idIn('val')).reads).toMatchObject({ on: false });
    expect(sessionPlan(idIn('test')).reads.why).toMatch(/verify session/);
  });
});

const visit = (id: string, sessionId: string, extra: object) => ({
  id,
  image: `${id}.jpg`,
  width: 400,
  height: 300,
  createdAt: `2026-11-06T20:${String(id.length).padStart(2, '0')}:00.000Z`,
  sessionId,
  sessionStartedAt: '2026-11-06T20:00:00.000Z',
  calibration,
  prefillModel: 'v6',
  prefill: { calibration, tips: [T20, S5, S1] },
  seconds: 7,
  ...extra,
});
const readOf = (darts: [string, { x: number; y: number }][]) => ({
  model: 'v6',
  darts: darts.map(([value, p]) => ({ value, sure: true, ...p })),
});

describe('ingesting reads', () => {
  it('keeps a confirmed read out of the queue and a fixed one in it', async () => {
    const s = idIn('train');
    await ingestCapture(
      visit('r-1', s, {
        labelMode: 'read',
        read: readOf([
          ['T20', T20],
          ['5', S5],
          ['1', S1],
        ]),
        darts: [
          { ...T20, value: 'T20' },
          { ...S5, value: '5' },
          { ...S1, value: '1' },
        ],
      }),
      await jpeg(),
      'phone',
    );
    await ingestCapture(
      visit('r-22', s, {
        labelMode: 'read',
        read: readOf([
          ['T20', T20],
          ['20', S5],
          ['1', S1],
        ]),
        prefill: { calibration, tips: [T20, S5, S1] },
        darts: [
          { ...T20, value: 'T20' },
          { ...S5, value: '5' },
          { ...S1, value: '1' },
        ],
      }),
      await jpeg(),
      'phone',
    );
    const rows = db().select().from(reads).all();
    expect(rows.map((r) => [r.captureId, r.outcome, r.valuesChanged])).toEqual([
      ['r-1', 'confirmed', 0],
      ['r-22', 'fixed', 1],
    ]);
    expect(getCapture('r-1')!.review).toBeNull();
    expect(getCapture('r-22')!.review).toBe(READ_FIXED);
    expect(listCaptures({ review: true }).cards.map((c) => c.id)).toEqual(['r-22']);
    // Looks right clears it.
    expect(confirmCorrected('r-22')).toBeNull();
  });

  it('records a blind check, and one that disagreed goes to review', async () => {
    const s = idIn('train');
    await ingestCapture(
      visit('b-1', s, {
        labelMode: 'blind',
        read: readOf([
          ['T20', T20],
          ['5', S5],
          ['1', S1],
        ]),
        blind: { values: ['T20', '20', '1'], agreed: false, chose: 'model' },
        darts: [
          { ...T20, value: 'T20' },
          { ...S5, value: '5' },
          { ...S1, value: '1' },
        ],
      }),
      await jpeg(),
      'phone',
    );
    expect(getCapture('b-1')!.review).toBe(BLIND_DISAGREED);
    expect(blindAgreement()).toMatchObject({ checks: 1, agreed: 0, paused: false });
  });

  it('pauses reads once blind checks stop agreeing', async () => {
    setReadsSettings({ mode: 'train' });
    activate(0.95);
    const s = idIn('train');
    for (let i = 0; i < 10; i++) {
      await ingestCapture(
        visit(`p-${'x'.repeat(i)}`, s, {
          labelMode: 'blind',
          read: readOf([['T20', T20]]),
          blind: { values: ['T20'], agreed: i > 0 },
          darts: [{ ...T20, value: 'T20' }],
        }),
        await jpeg(),
        'phone',
      );
    }
    expect(blindAgreement()).toMatchObject({ checks: 10, agreed: 9, paused: true });
    expect(sessionPlan(s).reads.why).toBe('paused: blind checks agree on 90%');
  });
});
