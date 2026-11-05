import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { boardPointOf, CALIBRATION_IDS } from '@domain/camera';
import { polar } from '@domain/board';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDbForTests } from './db/client';
import {
  deleteCapture,
  deleteSession,
  importFolder,
  ingestCapture,
  IngestError,
  saveLabel,
  setRejected,
} from './ingest';
import {
  getCapture,
  hitCounts,
  listCaptures,
  listCaptureSessions,
  listSessions,
  overviewCounts,
  viewCounts,
} from './queries';
import { splitOf } from './splits';
import { storedFile } from './storage';

const toImage = (p: { x: number; y: number }) => ({
  x: 0.5 + (p.x / 170) * 0.3,
  y: 0.5 - (p.y / 170) * 0.3,
});
const calibration = CALIBRATION_IDS.map((id) => toImage(boardPointOf(id)));

/** A Ton Up "Keep photos" label file (src/features/camera/captures.ts). */
function tonupFile(id: string, createdAt: string) {
  return {
    image: `${id}.jpg`,
    width: 400,
    height: 300,
    typeId: 'x01',
    modelVersion: null,
    createdAt,
    calibration,
    darts: [toImage(polar(103, 0)), toImage(polar(130, -18))],
    missed: 1,
  };
}

const jpeg = (w = 400, h = 300) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#556677' } })
    .jpeg()
    .toBuffer();

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-test-'));
  process.env.TONUP_LAB_DATA = path.join(dir, 'data');
  closeDbForTests();
});
afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('ingestCapture', () => {
  it('adds a Ton Up capture with a per-day session, its split, photo and label', async () => {
    const r = await ingestCapture(
      tonupFile('abc-1', '2026-11-03T20:00:00.000Z'),
      await jpeg(),
      'import',
    );
    expect(r).toEqual({
      id: 'abc-1',
      sessionId: 'tonup-2026-11-03',
      split: splitOf('tonup-2026-11-03'),
      created: true,
    });
    expect(fs.existsSync(path.join(dir, 'data', 'photos', 'abc-1.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'data', 'thumbs', 'abc-1.jpg'))).toBe(true);
    const c = getCapture('abc-1')!;
    expect(c.points).toHaveLength(5);
    // Ton Up's files have no entered values: tips are scored, nothing to compare.
    expect(c.darts.map((d) => [d.entered, d.scored])).toEqual([
      [null, 'T20'],
      [null, '5'],
    ]);
    expect(c.missed).toBe(1);
    expect(c.review).toBeNull();
    expect(c.status).toBe('labelled');
    expect(c.history).toHaveLength(1);
  });

  it('is idempotent by capture ID', async () => {
    const f = tonupFile('abc-2', '2026-11-03T20:00:00.000Z');
    await ingestCapture(f, await jpeg(), 'phone');
    const again = await ingestCapture(f, await jpeg(), 'phone');
    expect(again.created).toBe(false);
    expect(overviewCounts().captures).toBe(1);
  });

  it('takes a Capture upload with its session, tags, values and flags', async () => {
    const r = await ingestCapture(
      {
        id: 'cap-1',
        image: 'cap-1.jpg',
        width: 400,
        height: 300,
        createdAt: '2026-11-04T05:00:00.000Z',
        sessionId: 'sess-a',
        sessionStartedAt: '2026-11-04T04:50:00.000Z',
        tags: ['light on', 'left'],
        calibration,
        darts: [
          { ...toImage(polar(103, 0)), value: 'T20' },
          { ...toImage(polar(130, -18)), value: '20', onWire: true },
          { x: null, y: null, value: 'Miss' },
        ],
        prefillModel: 'v3',
        zoom: 1,
        deviceModel: 'iPhone 16 Pro',
      },
      await jpeg(),
      'phone',
    );
    expect(r.sessionId).toBe('sess-a');
    const c = getCapture('cap-1')!;
    expect(c.tags.sort()).toEqual(['left', 'light on']);
    expect(c.darts.map((d) => [d.entered, d.scored, d.onWire])).toEqual([
      ['T20', 'T20', false],
      ['20', '5', true],
      ['Miss', null, false],
    ]);
    expect(c.review).toBe('value mismatch, on the wire');
    expect(c.prefillModel).toBe('v3');
    expect(overviewCounts().toReview).toBe(1);
    expect(listCaptures({ review: true }).total).toBe(1);
  });

  it('takes a photo sent to label here, keeps it out of the dataset, then takes its label', async () => {
    const meta = {
      id: 'ul-1',
      image: 'ul-1.jpg',
      width: 400,
      height: 300,
      createdAt: '2026-11-04T05:00:00.000Z',
      sessionId: 'sess-u',
      sessionStartedAt: '2026-11-04T04:50:00.000Z',
      tags: [],
      calibration: [],
      darts: [],
      unlabelled: true,
    };
    await ingestCapture(meta, await jpeg(), 'phone');
    expect(getCapture('ul-1')).toMatchObject({ status: 'unlabelled', review: 'not labelled' });
    expect(overviewCounts()).toMatchObject({ unlabelled: 1, toReview: 1 });
    expect(Object.values(overviewCounts().bySplit).reduce((a, b) => a + b, 0)).toBe(0);
    expect(listSessions().map((x) => x.id)).toEqual(['sess-u']);
    // Left out and put back, it's still to label.
    setRejected('ul-1', true);
    expect(setRejected('ul-1', false)).toBe('unlabelled');
    // Labelled on the phone after all: the label is taken as its next version.
    const again = await ingestCapture(
      {
        ...meta,
        unlabelled: undefined,
        calibration,
        darts: [{ ...toImage(polar(103, 0)), value: 'T20' }],
      },
      await jpeg(),
      'phone',
    );
    expect(again).toMatchObject({ created: false, updated: true });
    expect(getCapture('ul-1')).toMatchObject({ status: 'labelled', review: null });
  });

  it('takes the label for a photo sent to label, from the editor', async () => {
    await ingestCapture(
      {
        id: 'ul-2',
        image: 'ul-2.jpg',
        width: 400,
        height: 300,
        createdAt: '2026-11-04T05:00:00.000Z',
        sessionId: 'sess-u',
        calibration: [],
        darts: [],
        unlabelled: true,
      },
      await jpeg(),
      'phone',
    );
    saveLabel('ul-2', {
      points: {},
      darts: [{ entered: 'T20', tip: null, onWire: false }],
      missed: 0,
    });
    expect(getCapture('ul-2')).toMatchObject({ status: 'values-only', review: null });
  });

  it('counts the gallery’s views, where darts landed, and groups captures by session', async () => {
    const visit = (id: string, session: string, at: string, values: string[]) =>
      ingestCapture(
        {
          id,
          image: `${id}.jpg`,
          width: 400,
          height: 300,
          createdAt: at,
          sessionId: session,
          sessionStartedAt: at,
          calibration,
          darts: values.map((value, i) => ({ ...toImage(polar(103, i * 18)), value })),
        },
        jpegSync,
        'phone',
      );
    const jpegSync = await jpeg();
    await visit('g1', 'sa', '2026-11-01T20:00:00.000Z', ['T20', 'T20', '1']);
    await visit('g2', 'sa', '2026-11-01T20:05:00.000Z', ['T20', 'D18', 'Miss']);
    await visit('g3', 'sb', '2026-11-02T20:00:00.000Z', ['5', 'Bull', '25']);
    const counts = viewCounts({});
    expect(counts.all).toBe(3);
    expect(counts.train + counts.val + counts.test).toBe(3);
    expect(hitCounts({}).hits).toMatchObject({
      T20: 3,
      D18: 1,
      '1': 1,
      Miss: 1,
      '5': 1,
      Bull: 1,
      '25': 1,
    });
    expect(hitCounts({ sessionId: 'sb' })).toEqual({
      hits: { '5': 1, Bull: 1, '25': 1 },
      darts: 3,
    });
    const groups = listCaptureSessions({});
    expect(groups.rows.map((r) => [r.session.id, r.total, r.cards.map((c) => c.id)])).toEqual([
      ['sb', 1, ['g3']],
      ['sa', 2, ['g2', 'g1']],
    ]);
  });

  it('keeps values-only captures for verification and marks them so', async () => {
    await ingestCapture(
      {
        id: 'vo-1',
        image: 'vo-1.jpg',
        width: 400,
        height: 300,
        createdAt: '2026-11-04T05:00:00.000Z',
        sessionId: 'sess-b',
        valuesOnly: true,
        calibration,
        darts: [{ value: 'T20' }, { value: '5' }, { value: '1' }],
      },
      await jpeg(),
      'phone',
    );
    expect(getCapture('vo-1')!.status).toBe('values-only');
    expect(getCapture('vo-1')!.dartCount).toBe(3); // darts in the board, from the values entered
  });

  it('takes a values-only capture again once the phone has added its tips', async () => {
    const base = {
      id: 'vo-2',
      image: 'vo-2.jpg',
      width: 400,
      height: 300,
      createdAt: '2026-11-04T05:00:00.000Z',
      sessionId: 'sess-c',
      calibration,
    };
    await ingestCapture(
      { ...base, valuesOnly: true, darts: [{ value: 'T20' }, { value: '20' }] },
      await jpeg(),
      'phone',
    );
    // The same values only again: ignored.
    const again = await ingestCapture(
      { ...base, valuesOnly: true, darts: [{ value: 'T20' }, { value: '20' }] },
      await jpeg(),
      'phone',
    );
    expect(again.updated).toBeUndefined();
    const r = await ingestCapture(
      {
        ...base,
        valuesOnly: false,
        darts: [
          { ...toImage(polar(103, 0)), value: 'T20' },
          { ...toImage(polar(130, 0)), value: '20' },
        ],
      },
      await jpeg(),
      'phone',
    );
    expect(r).toMatchObject({ created: false, updated: true });
    const c = getCapture('vo-2')!;
    expect(c.status).toBe('labelled');
    expect(c.history.map((h) => [h.version, h.source])).toEqual([
      [2, 'phone'],
      [1, 'phone'],
    ]);
    expect(c.darts.map((d) => d.scored)).toEqual(['T20', '20']);
  });

  it('turns photos upright from their EXIF orientation', async () => {
    const rotated = await sharp(await jpeg(400, 300))
      .withMetadata({ orientation: 6 })
      .toBuffer();
    await ingestCapture(tonupFile('rot-1', '2026-11-03T20:00:00.000Z'), rotated, 'import');
    const c = getCapture('rot-1')!;
    expect([c.width, c.height]).toEqual([300, 400]);
  });

  it('rejects files that aren’t labels or have unsafe IDs', async () => {
    await expect(ingestCapture({ image: 'x.jpg' }, await jpeg(), 'phone')).rejects.toThrow(
      IngestError,
    );
    await expect(
      ingestCapture(
        { ...tonupFile('../evil', '2026-11-03T20:00:00Z'), id: '../evil' },
        await jpeg(),
        'phone',
      ),
    ).rejects.toThrow(IngestError);
  });
});

describe('label versions', () => {
  it('saves edits as new versions and re-measures', async () => {
    await ingestCapture(tonupFile('ed-1', '2026-11-03T20:00:00.000Z'), await jpeg(), 'import');
    const before = getCapture('ed-1')!;
    const points = Object.fromEntries(before.points.map((p) => [p.kind, { x: p.x, y: p.y }]));
    saveLabel('ed-1', {
      points,
      darts: [
        { entered: 'T20', tip: toImage(polar(103, 0)), onWire: false },
        { entered: 'T20', tip: toImage(polar(130, -18)), onWire: false },
      ],
      missed: 0,
    });
    const after = getCapture('ed-1')!;
    expect(after.history.map((h) => [h.version, h.source, h.current])).toEqual([
      [2, 'lab', true],
      [1, 'import', false],
    ]);
    expect(after.review).toBe('value mismatch');
    expect(after.missed).toBe(0);
  });

  it('leaves a capture out of training and puts it back', async () => {
    await ingestCapture(tonupFile('rj-1', '2026-11-03T20:00:00.000Z'), await jpeg(), 'import');
    expect(setRejected('rj-1', true)).toBe('rejected');
    expect(overviewCounts().rejected).toBe(1);
    expect(setRejected('rj-1', false)).toBe('labelled');
  });
});

describe('importFolder', () => {
  it('imports every label file with its photo, and skips them the second time', async () => {
    const folder = path.join(dir, 'captures');
    fs.mkdirSync(folder);
    for (const [id, day] of [
      ['f-1', '2026-11-01'],
      ['f-2', '2026-11-01'],
      ['f-3', '2026-11-02'],
    ] as const) {
      fs.writeFileSync(
        path.join(folder, `${id}.json`),
        JSON.stringify(tonupFile(id, `${day}T20:00:00Z`)),
      );
      fs.writeFileSync(path.join(folder, `${id}.jpg`), await jpeg());
    }
    fs.writeFileSync(path.join(folder, 'broken.json'), JSON.stringify({ image: 'nope.jpg' }));
    const first = await importFolder(folder);
    expect(first.imported).toBe(3);
    expect(first.failed.map((f) => f.file)).toEqual(['broken.json']);
    expect((await importFolder(folder)).skipped).toBe(3);
    expect(listSessions().map((s) => [s.id, s.captures])).toEqual([
      ['tonup-2026-11-02', 1],
      ['tonup-2026-11-01', 2],
    ]);
  });
});

describe('deleting', () => {
  it('deletes a capture with its labels and files, and leaves the rest of its session', async () => {
    await ingestCapture(tonupFile('del-1', '2026-11-03T20:00:00.000Z'), await jpeg(), 'import');
    await ingestCapture(tonupFile('del-2', '2026-11-03T20:01:00.000Z'), await jpeg(), 'import');
    saveLabel('del-1', { points: {}, darts: [], missed: 0 });
    expect(storedFile('photo', 'del-1.jpg')).not.toBeNull();

    expect(deleteCapture('del-1')).toEqual({ id: 'del-1', sessionId: 'tonup-2026-11-03' });
    expect(getCapture('del-1')).toBeNull();
    expect(storedFile('photo', 'del-1.jpg')).toBeNull();
    expect(storedFile('thumb', 'del-1.jpg')).toBeNull();
    expect(listSessions()).toMatchObject([{ id: 'tonup-2026-11-03', captures: 1 }]);
    expect(overviewCounts().captures).toBe(1);
    expect(() => deleteCapture('del-1')).toThrow(IngestError);
  });

  it('deletes a session with all its captures', async () => {
    await ingestCapture(tonupFile('s-1', '2026-11-03T20:00:00.000Z'), await jpeg(), 'import');
    await ingestCapture(tonupFile('s-2', '2026-11-03T21:00:00.000Z'), await jpeg(), 'import');
    await ingestCapture(tonupFile('other', '2026-11-04T20:00:00.000Z'), await jpeg(), 'import');
    expect(deleteSession('tonup-2026-11-03')).toEqual({ id: 'tonup-2026-11-03', captures: 2 });
    expect(listSessions().map((x) => x.id)).toEqual(['tonup-2026-11-04']);
    expect(storedFile('photo', 's-2.jpg')).toBeNull();
    expect(getCapture('other')).not.toBeNull();
    // Gone for good: importing the same file again brings it back as new.
    const again = await ingestCapture(
      tonupFile('s-1', '2026-11-03T20:00:00.000Z'),
      await jpeg(),
      'import',
    );
    expect(again).toMatchObject({ created: true, split: splitOf('tonup-2026-11-03') });
  });
});
