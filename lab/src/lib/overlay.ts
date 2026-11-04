// Drawing a label over its photo: the board's rings and wires through the fit, in the photo's
// pixel space (an SVG viewBox of width × height). Plain functions, used on the server and client.
import { polar, STEEL_TIP_RADII_MM as R } from '@domain/board';
import { applyHomography, fitBoard, type CalibrationId, type ImagePoint } from '@domain/camera';

export type Points = Partial<Record<CalibrationId, ImagePoint>>;

export interface BoardDrawing {
  rings: string;
  wires: string;
}

/** SVG paths for the board's rings and segment wires, or null when the board isn't marked. */
export function boardDrawing(points: Points, width: number, height: number): BoardDrawing | null {
  const fit = fitBoard(points);
  if (!fit) return null;
  const px = (p: { x: number; y: number }) => {
    const q = applyHomography(fit.toImage, p);
    return `${(q.x * width).toFixed(1)} ${(q.y * height).toFixed(1)}`;
  };
  const radii = [
    R.doubleOuter,
    R.doubleInner,
    R.trebleOuter,
    R.trebleInner,
    R.outerBull,
    R.innerBull,
  ];
  const rings = radii
    .map((r) => {
      const steps = r < 20 ? 24 : 96;
      const pts = Array.from({ length: steps }, (_, i) => px(polar(r, (i * 360) / steps)));
      return `M${pts.join(' L')} Z`;
    })
    .join(' ');
  const wires = Array.from({ length: 20 }, (_, i) => {
    const deg = i * 18 - 9;
    return `M${px(polar(R.outerBull, deg))} L${px(polar(R.doubleOuter, deg))}`;
  }).join(' ');
  return { rings, wires };
}

export const KEYPOINT_LABELS: Record<CalibrationId, string> = {
  cal20: '5/20',
  cal6: '13/6',
  cal3: '17/3',
  cal11: '8/11',
  bull: 'Bull',
};
