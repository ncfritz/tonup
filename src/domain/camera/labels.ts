// Training labels from a confirmed photo (ADR 0011), in the DeepDarts layout: the four
// calibration points, then the bull, then each dart tip, as normalised image coordinates.
import type { CalibrationId, ImagePoint } from './geometry';
import { CALIBRATION_IDS } from './geometry';

export interface CaptureLabels {
  /** DeepDarts order: cal20, cal6, cal3, cal11, then bull (ours), each null if not visible. */
  calibration: (ImagePoint | null)[];
  darts: ImagePoint[];
  /** Darts the player said missed the board (not in the photo). */
  missed: number;
}

export function captureLabels(
  calibration: Partial<Record<CalibrationId, ImagePoint>>,
  darts: ImagePoint[],
  missed: number,
): CaptureLabels {
  return {
    calibration: CALIBRATION_IDS.map((id) => {
      const p = calibration[id];
      return p ? { x: round(p.x), y: round(p.y) } : null;
    }),
    darts: darts.map((d) => ({ x: round(d.x), y: round(d.y) })),
    missed,
  };
}

const round = (v: number) => Math.round(v * 1e5) / 1e5;
