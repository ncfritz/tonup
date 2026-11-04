import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { boardPointOf, CALIBRATION_IDS } from '@domain/camera';
import { polar } from '@domain/board';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDbForTests } from './db/client';
import { importFolder, ingestCapture, IngestError, saveLabel, setRejected } from './ingest';
import { getCapture, listCaptures, listSessions, overviewCounts } from './queries';
import { splitOf } from './splits';

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
    expect(getCapture('vo-1')!.dartCount).toBe(0);
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
