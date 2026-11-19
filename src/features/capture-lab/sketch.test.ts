import { polar } from '@/domain/board';
import { applyHomography, boardPointOf, CALIBRATION_IDS, fitHomography } from '@/domain/camera';

import { sketchTips } from './sketch';

// The board seen a little from the left, as in the visit tests.
const CAMERA = fitHomography([
  { from: { x: -170, y: 170 }, to: { x: 0.25, y: 0.1 } },
  { from: { x: 170, y: 170 }, to: { x: 0.78, y: 0.12 } },
  { from: { x: 170, y: -170 }, to: { x: 0.75, y: 0.9 } },
  { from: { x: -170, y: -170 }, to: { x: 0.28, y: 0.88 } },
])!;
const img = (p: { x: number; y: number }) => applyHomography(CAMERA, p);
const calibration = CALIBRATION_IDS.map((id) => img(boardPointOf(id)));

describe('sketchTips', () => {
  it('puts each tip back on the board square on, numbered in throwing order', () => {
    const t20 = polar(103, 0);
    const s5 = polar(130, -18);
    const tips = sketchTips({
      calibration,
      darts: [
        { ...img(t20), value: 'T20' },
        { x: null, y: null, value: 'Miss' },
        { ...img(s5), value: '5' },
      ],
    })!;
    expect(tips.map((t) => t.n)).toEqual([1, 3]);
    expect(tips[0]!.point.x).toBeCloseTo(t20.x, 3);
    expect(tips[0]!.point.y).toBeCloseTo(t20.y, 3);
    expect(tips[1]!.point.y).toBeCloseTo(s5.y, 3);
  });

  it('draws nothing without enough board points to fit', () => {
    expect(
      sketchTips({ calibration: [calibration[0]!, null, null, null, null], darts: [] }),
    ).toBeNull();
  });
});
