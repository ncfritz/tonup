import { applyHomography, boardPointOf, CALIBRATION_IDS, fitHomography } from '@/domain/camera';
import { centreOf } from '@/domain/board';
import type { Point } from '@/domain/darts';

import {
  addMiss,
  complete,
  fromDetection,
  markStep,
  proposals,
  remark,
  remove,
  select,
  tap,
} from './snap';

const CAMERA = fitHomography([
  { from: { x: -170, y: 170 }, to: { x: 0.2, y: 0.15 } },
  { from: { x: 170, y: 170 }, to: { x: 0.8, y: 0.15 } },
  { from: { x: 170, y: -170 }, to: { x: 0.85, y: 0.85 } },
  { from: { x: -170, y: -170 }, to: { x: 0.15, y: 0.85 } },
])!;
const snap = (p: Point) => applyHomography(CAMERA, p);
const photo = { uri: 'file:///p.jpg', width: 4032, height: 3024 };
const T20 = centreOf({ segment: 20, multiplier: 3 });
const D16 = centreOf({ segment: 16, multiplier: 2 });

const detected = (tips: { p: Point; c: number }[]) => ({
  width: 4032,
  height: 3024,
  sharpness: 100,
  modelVersion: 'test',
  keypoints: Object.fromEntries(
    CALIBRATION_IDS.map((id) => [id, { ...snap(boardPointOf(id)), c: 0.9 }]),
  ),
  tips: tips.map((t) => ({ ...snap(t.p), c: t.c })),
});

describe('snap to score', () => {
  it('goes straight to review when the model finds the board', () => {
    const s = fromDetection(
      photo,
      detected([
        { p: T20, c: 0.9 },
        { p: D16, c: 0.8 },
      ]),
      3,
    );
    expect(s.board).toBe('model');
    expect(s.phase.kind).toBe('review');
    expect(
      proposals(s)
        .map((d) => d.hit.score)
        .sort(),
    ).toEqual([32, 60]);
    expect(complete(s)).toBe(false);
    expect(complete(addMiss(s))).toBe(true);
  });

  it('marks the board by hand without a model, then takes taps as darts', () => {
    let s = fromDetection(photo, null, 3);
    expect(markStep(s)).toBe('cal20');
    for (const id of CALIBRATION_IDS) s = tap(s, snap(boardPointOf(id)));
    expect(s.phase.kind).toBe('review');
    s = tap(s, snap(T20));
    s = tap(s, snap(T20));
    s = tap(s, snap(D16));
    // A fourth tap does nothing: three darts are in.
    expect(tap(s, snap(T20)).darts).toHaveLength(3);
    expect(proposals(s).map((d) => d.hit.score)).toEqual([60, 60, 32]);
    expect(complete(s)).toBe(true);
  });

  it('starts marking again when the points make no board', () => {
    let s = fromDetection(photo, null, 3);
    for (const id of CALIBRATION_IDS) s = tap(s, snap(boardPointOf(id === 'bull' ? 'cal20' : id)));
    expect(s.phase).toEqual({ kind: 'mark', step: 0, failed: true });
  });

  it('moves, removes and re-marks', () => {
    let s = fromDetection(photo, detected([{ p: T20, c: 0.9 }]), 3);
    s = select(s, 0);
    s = tap(s, snap(D16));
    expect(proposals(s)[0]!.hit.score).toBe(32);
    s = remove(s, 0);
    expect(s.darts).toHaveLength(0);
    expect(remark(s).phase).toEqual({ kind: 'mark', step: 0 });
  });

  it("ignores the model's board when the points don't agree", () => {
    const d = detected([]);
    d.keypoints.bull = { ...snap({ x: 30, y: 0 }), c: 0.9 };
    expect(fromDetection(photo, d, 3).board).toBe('manual');
  });
});
