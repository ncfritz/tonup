// A visit drawn from its label alone, for when the photo isn't on the phone and Lab can't send
// it (docs/plan/capture-lab.md › Photos and the full-size view): the board square on, and where
// each dart landed on it, through the board the label's points fit.
import {
  applyHomography,
  CALIBRATION_IDS,
  fitBoard,
  type CalibrationId,
  type ImagePoint,
} from '@/domain/camera';
import type { Point } from '@/domain/darts';

import type { LabelFile } from './visit';

/** A dart on the board: where its tip landed (board mm, y up) and its number in the visit. */
export interface SketchTip {
  point: Point;
  n: number;
}

/** The label's board points, by ID (the file keeps them in CALIBRATION_IDS order). */
export function calibrationOf(label: Pick<LabelFile, 'calibration'>) {
  const c: Partial<Record<CalibrationId, ImagePoint>> = {};
  CALIBRATION_IDS.forEach((k, i) => {
    const p = label.calibration[i];
    if (p) c[k] = p;
  });
  return c;
}

/**
 * Each dart's tip on the board, square on, numbered in throwing order (a dart without a tip,
 * a miss or a values-only visit's, is left out). Null when the label's board points don't fit a
 * board: then there's nothing to draw it on.
 */
export function sketchTips(label: Pick<LabelFile, 'calibration' | 'darts'>): SketchTip[] | null {
  const fit = fitBoard(calibrationOf(label));
  if (!fit) return null;
  return label.darts.flatMap((d, i) =>
    d.x !== null && d.y !== null
      ? [{ point: applyHomography(fit.toBoard, { x: d.x, y: d.y }), n: i + 1 }]
      : [],
  );
}
