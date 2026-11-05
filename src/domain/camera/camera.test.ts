import { centreOf, hitAt } from '../board';
import { BULL, type Point } from '../darts';

import {
  applyHomography,
  boardPointOf,
  CALIBRATION_IDS,
  captureLabels,
  fitBoard,
  fitHomography,
  MAX_RESIDUAL_MM,
  pickDarts,
  propose,
  wireDistance,
  type CalibrationId,
  type ImagePoint,
} from '.';

/** A camera looking at the board from below and to the left: board mm → normalised image. */
const CAMERA = fitHomography([
  { from: { x: -170, y: 170 }, to: { x: 0.22, y: 0.12 } },
  { from: { x: 170, y: 170 }, to: { x: 0.8, y: 0.18 } },
  { from: { x: 170, y: -170 }, to: { x: 0.74, y: 0.86 } },
  { from: { x: -170, y: -170 }, to: { x: 0.3, y: 0.78 } },
])!;
const snap = (p: Point): ImagePoint => applyHomography(CAMERA, p);
const keypoints = () =>
  Object.fromEntries(CALIBRATION_IDS.map((id) => [id, snap(boardPointOf(id))])) as Record<
    CalibrationId,
    ImagePoint
  >;

describe('scoring from a photo', () => {
  it('puts the calibration points where the wires meet the double ring', () => {
    // Just clockwise of cal20 is the 20; just anticlockwise is the 5.
    const p = boardPointOf('cal20');
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(170);
    expect(hitAt({ x: p.x * 0.97 + 1, y: p.y * 0.97 }).segment).toBe(20);
    expect(hitAt({ x: p.x * 0.97 - 1, y: p.y * 0.97 }).segment).toBe(5);
    expect(
      hitAt({ x: boardPointOf('cal6').x * 0.97, y: boardPointOf('cal6').y * 0.97 + 1 }).segment,
    ).toBe(13);
  });

  it('maps darts back to the board through the fitted homography', () => {
    const fit = fitBoard(keypoints())!;
    expect(fit.residual).toBeLessThan(0.01);
    const t20 = centreOf({ segment: 20, multiplier: 3 });
    const d = propose(fit, snap(t20), 0.9);
    expect(d.point.x).toBeCloseTo(t20.x, 3);
    expect(d.point.y).toBeCloseTo(t20.y, 3);
    expect(d.hit).toMatchObject({ segment: 20, multiplier: 3 });
    expect(d.nearWire).toBe(false);
    // And the board outline back onto the photo.
    const back = applyHomography(fit.toImage, { x: 0, y: 0 });
    expect(back.x).toBeCloseTo(snap({ x: 0, y: 0 }).x, 4);
  });

  it('fits from four points, and flags a fifth that disagrees', () => {
    const k = keypoints();
    const { bull: _bull, ...four } = k;
    void _bull;
    expect(fitBoard(four)!.used).toHaveLength(4);
    const { cal3: _c, cal11: _d, ...three } = k;
    void _c;
    void _d;
    expect(fitBoard(three)).toBeNull();
    // A bull 15 mm out shows up as a large residual.
    const off = fitBoard({ ...k, bull: snap({ x: 15, y: 0 }) })!;
    expect(off.residual).toBeGreaterThan(MAX_RESIDUAL_MM);
    // ...and the bull is the point furthest out, so Lab can point at it.
    const worst = Object.entries(off.errors).sort((a, b) => b[1] - a[1])[0]![0];
    expect(worst).toBe('bull');
    expect(off.errors.bull).toBe(off.residual);
  });

  it('flags darts near a wire', () => {
    expect(wireDistance({ x: 0, y: 103 })).toBeCloseTo(4);
    expect(wireDistance({ x: 0, y: 107.5 })).toBeCloseTo(0.5);
    const edge = {
      x: 104 * Math.sin((9 * Math.PI) / 180) - 0.5,
      y: 104 * Math.cos((9 * Math.PI) / 180),
    };
    expect(wireDistance(edge)).toBeLessThan(1);
    expect(wireDistance({ x: 0, y: 0 })).toBeCloseTo(6.35);
  });

  it('picks the most confident darts in reading order', () => {
    const fit = fitBoard(keypoints())!;
    const at = (p: Point, confidence: number) => ({ ...snap(p), confidence });
    const darts = pickDarts(
      fit,
      [
        at(centreOf({ segment: 20, multiplier: 3 }), 0.9),
        at(centreOf({ segment: 5, multiplier: 1 }), 0.8),
        at(centreOf({ segment: 1, multiplier: 1 }), 0.95),
        at(centreOf({ segment: BULL, multiplier: 2 }), 0.2),
      ],
      3,
    );
    expect(darts.map((d) => d.hit.segment)).toEqual([5, 20, 1]);
  });

  it('writes labels in the DeepDarts order with the bull last', () => {
    const k = keypoints();
    const labels = captureLabels(
      { cal20: k.cal20, cal6: k.cal6, cal3: k.cal3, bull: k.bull },
      [{ x: 0.123456789, y: 0.5 }],
      1,
    );
    expect(labels.calibration[3]).toBeNull();
    expect(labels.calibration[4]).not.toBeNull();
    expect(labels.darts[0]).toEqual({ x: 0.12346, y: 0.5 });
    expect(labels.missed).toBe(1);
  });
});
