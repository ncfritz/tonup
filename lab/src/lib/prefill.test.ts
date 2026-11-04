import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { boardPointOf, CALIBRATION_IDS, type ImagePoint } from '@domain/camera';
import { polar } from '@domain/board';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDbForTests } from './db/client';
import { ingestCapture } from './ingest';
import type { LabelInput } from './labels';
import { checkPrefill, CORRECTED, type Proposal } from './prefill';
import { getCapture, listCaptures, prefillStats } from './queries';

// A face-on board 0.6 of the photo across: 1 mm on the board is 0.3/170 of the photo.
const toImage = (p: { x: number; y: number }): ImagePoint => ({
  x: 0.5 + (p.x / 170) * 0.3,
  y: 0.5 - (p.y / 170) * 0.3,
});
const calibration = CALIBRATION_IDS.map((id) => toImage(boardPointOf(id)));
const tips = [toImage(polar(103, 0)), toImage(polar(103, 18)), toImage(polar(60, 90))];
const mm = (n: number) => (n / 170) * 0.3;

function confirmed(over: Partial<{ calibration: ImagePoint[]; tips: (ImagePoint | null)[] }> = {}) {
  const cal = over.calibration ?? calibration;
  const points: LabelInput['points'] = {};
  CALIBRATION_IDS.forEach((id, i) => (points[id] = cal[i]!));
  return {
    points,
    darts: (over.tips ?? tips).map((tip) => ({ entered: 'T20', tip, onWire: false })),
    missed: 0,
  } satisfies LabelInput;
}
const proposal: Proposal = { calibration, tips };

describe('checkPrefill', () => {
  it('accepts a pre-fill the player only confirmed', () => {
    expect(checkPrefill(proposal, confirmed())).toEqual({
      boardKept: true,
      boardMovedMm: 0,
      tipsNeeded: 3,
      tipsPlaced: 3,
      tipsKept: 3,
      accepted: true,
    });
  });

  it('treats a small nudge as kept and a real move as a correction', () => {
    const nudged = { ...tips[0]!, x: tips[0]!.x + mm(2) };
    expect(checkPrefill(proposal, confirmed({ tips: [nudged, tips[1]!, tips[2]!] })).accepted).toBe(
      true,
    );
    const moved = { ...tips[0]!, x: tips[0]!.x + mm(10) };
    expect(checkPrefill(proposal, confirmed({ tips: [moved, tips[1]!, tips[2]!] }))).toMatchObject({
      boardKept: true,
      tipsKept: 2,
      accepted: false,
    });
  });

  it('notices a re-marked board and a tip the model missed', () => {
    const cal = calibration.map((p, i) => (i === 0 ? { ...p, y: p.y + mm(8) } : p));
    const r = checkPrefill(proposal, confirmed({ calibration: cal }));
    expect(r.boardKept).toBe(false);
    expect(r.boardMovedMm).toBeGreaterThan(5);
    const partial = checkPrefill({ calibration, tips: [tips[0]!, null, tips[2]!] }, confirmed());
    expect(partial).toMatchObject({ tipsPlaced: 2, tipsKept: 2, accepted: false });
  });
});

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-prefill-'));
  process.env.TONUP_LAB_DATA = path.join(dir, 'data');
  closeDbForTests();
});
afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

const jpeg = () =>
  sharp({ create: { width: 400, height: 300, channels: 3, background: '#556677' } })
    .jpeg()
    .toBuffer();

function captureFile(id: string, minute: number, prefillTips: (ImagePoint | null)[]) {
  return {
    id,
    image: `${id}.jpg`,
    width: 400,
    height: 300,
    createdAt: `2026-11-04T10:${String(minute).padStart(2, '0')}:00Z`,
    sessionId: 'sess-1',
    calibration,
    darts: [
      { ...tips[0]!, value: 'T20' },
      { ...tips[1]!, value: 'T1' },
    ],
    prefillModel: 'v3',
    prefill: { calibration, tips: prefillTips },
  };
}

describe('pre-fills from Capture', () => {
  it('stores the proposal, queues corrected labels first and counts acceptance per model', async () => {
    await ingestCapture(captureFile('ok', 1, [tips[0]!, tips[1]!]), await jpeg(), 'phone');
    await ingestCapture(
      captureFile('fixed', 0, [tips[0]!, { ...tips[1]!, y: tips[1]!.y + mm(12) }]),
      await jpeg(),
      'phone',
    );
    const fixed = getCapture('fixed')!;
    expect(fixed.review).toBe(CORRECTED);
    expect(fixed.prefill).toMatchObject({
      model: 'v3',
      accepted: false,
      tipsKept: 1,
      tipsNeeded: 2,
    });
    expect(fixed.prefill!.calibration).toHaveLength(5);
    expect(fixed.prefill!.tips).toHaveLength(2);
    expect(getCapture('ok')!.review).toBeNull();
    expect(prefillStats()).toEqual([
      { model: 'v3', visits: 2, accepted: 1, boardKept: 2, tipsNeeded: 4, tipsKept: 3 },
    ]);

    // A wire-flagged label is in the queue too, after the corrected one even though it's newer.
    await ingestCapture(
      {
        ...captureFile('wire', 5, []),
        prefill: undefined,
        prefillModel: null,
        darts: [{ ...tips[0]!, value: 'T20', onWire: true }],
      },
      await jpeg(),
      'phone',
    );
    expect(listCaptures({ review: true }).cards.map((c) => c.id)).toEqual(['fixed', 'wire']);
    expect(getCapture('fixed')!.nextReviewId).toBe('wire');
  });
});
