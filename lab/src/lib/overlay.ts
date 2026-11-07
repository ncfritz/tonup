// Drawing a label over its photo: the board's rings and wires through the fit, in the photo's
// pixel space (an SVG viewBox of width × height). Plain functions, used on the server and client.
import { polar, segmentCentreDegrees, STEEL_TIP_RADII_MM as R } from '@domain/board';
import { applyHomography, fitBoard, type CalibrationId, type ImagePoint } from '@domain/camera';

import { normaliseValue } from './conditions';

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

/**
 * The bed an entered value names, through the board's fit, as an SVG path in photo pixels: where
 * that dart should be. A single is both its single beds (the value doesn't say which). Null for a
 * miss, a bounce-out, an unreadable value, or a board not marked well enough to fit. Fill it
 * with fill-rule evenodd (the outer bull's ring has a hole).
 */
export function bedPath(
  entered: string | null,
  points: Points,
  width: number,
  height: number,
): string | null {
  if (!entered) return null;
  const fit = fitBoard(points);
  if (!fit) return null;
  const px = (p: { x: number; y: number }) => {
    const q = applyHomography(fit.toImage, p);
    return `${(q.x * width).toFixed(1)} ${(q.y * height).toFixed(1)}`;
  };
  // An annular sector from r1 to r2 between two angles, its arcs in small steps so they stay
  // curved through the perspective.
  const sector = (r1: number, r2: number, from: number, to: number) => {
    const steps = Math.max(4, Math.ceil((to - from) / 3));
    const at = (i: number) => from + ((to - from) * i) / steps;
    const outer = Array.from({ length: steps + 1 }, (_, i) => px(polar(r2, at(i))));
    const inner = Array.from({ length: steps + 1 }, (_, i) => px(polar(r1, at(steps - i))));
    return `M${[...outer, ...inner].join(' L')} Z`;
  };
  const circle = (r: number) =>
    `M${Array.from({ length: 48 }, (_, i) => px(polar(r, i * 7.5))).join(' L')} Z`;
  // The outer bull's ring: its two circles, filled even-odd so the bull stays a hole.
  const ring = (r1: number, r2: number) => (r1 > 0 ? `${circle(r2)} ${circle(r1)}` : circle(r2));
  const v = normaliseValue(entered);
  if (v === 'Bull') return ring(0, R.innerBull);
  if (v === '25') return ring(R.innerBull, R.outerBull);
  const m = /^([DT]?)(\d{1,2})$/.exec(v);
  const n = m ? Number(m[2]) : NaN;
  if (!m || n < 1 || n > 20) return null;
  const deg = segmentCentreDegrees(n);
  const [a, b] = [deg - 9, deg + 9];
  if (m[1] === 'T') return sector(R.trebleInner, R.trebleOuter, a, b);
  if (m[1] === 'D') return sector(R.doubleInner, R.doubleOuter, a, b);
  return `${sector(R.outerBull, R.trebleInner, a, b)} ${sector(R.trebleOuter, R.doubleInner, a, b)}`;
}

export const KEYPOINT_LABELS: Record<CalibrationId, string> = {
  cal20: '5/20',
  cal6: '13/6',
  cal3: '17/3',
  cal11: '8/11',
  bull: 'Bull',
};
