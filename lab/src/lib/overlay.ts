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

/**
 * Where to write a highlighted bed's value, in photo pixels, and the value as written: just
 * outside the double ring on the segment's centre line, where a board's numbers are; for the
 * bulls, a little up and right of the bull. Null where bedPath draws nothing.
 */
export function bedLabel(
  entered: string | null,
  points: Points,
  width: number,
  height: number,
): { x: number; y: number; text: string } | null {
  if (!entered) return null;
  const fit = fitBoard(points);
  if (!fit) return null;
  const v = normaliseValue(entered);
  let at: { x: number; y: number };
  if (v === 'Bull' || v === '25') at = polar(R.outerBull + 14, 45);
  else {
    const m = /^([DT]?)(\d{1,2})$/.exec(v);
    const n = m ? Number(m[2]) : NaN;
    if (!m || n < 1 || n > 20) return null;
    at = polar(R.doubleOuter + 18, segmentCentreDegrees(n));
  }
  const q = applyHomography(fit.toImage, at);
  return { x: q.x * width, y: q.y * height, text: v };
}

/**
 * Points spread evenly over the bed an entered value names, in photo pixels: for putting its
 * value inside the part of the bed in view when zoomed (both single beds for a single). Empty
 * where bedPath draws nothing.
 */
export function bedSamples(
  entered: string | null,
  points: Points,
  width: number,
  height: number,
): { x: number; y: number }[] {
  if (!entered) return [];
  const fit = fitBoard(points);
  if (!fit) return [];
  const out: { x: number; y: number }[] = [];
  const add = (r1: number, r2: number, from: number, to: number, n = 10) => {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const q = applyHomography(
          fit.toImage,
          polar(r1 + ((r2 - r1) * (i + 0.5)) / n, from + ((to - from) * (j + 0.5)) / n),
        );
        out.push({ x: q.x * width, y: q.y * height });
      }
  };
  const v = normaliseValue(entered);
  if (v === 'Bull') add(0, R.innerBull, 0, 360);
  else if (v === '25') add(R.innerBull, R.outerBull, 0, 360, 14);
  else {
    const m = /^([DT]?)(\d{1,2})$/.exec(v);
    const n = m ? Number(m[2]) : NaN;
    if (!m || n < 1 || n > 20) return [];
    const deg = segmentCentreDegrees(n);
    const [a, b] = [deg - 9, deg + 9];
    if (m[1] === 'T') add(R.trebleInner, R.trebleOuter, a, b);
    else if (m[1] === 'D') add(R.doubleInner, R.doubleOuter, a, b);
    else {
      add(R.outerBull, R.trebleInner, a, b, 14);
      add(R.trebleOuter, R.doubleInner, a, b, 14);
    }
  }
  return out;
}

/**
 * Where a bed's value goes when zoomed in: in the part of the bed inside the view, at the
 * sample nearest that part's middle (so it stays in the bed even when the part is curved or
 * split, as a single's two beds are). Null when none of the bed is in view.
 */
export function inViewSpot(
  samples: readonly { x: number; y: number }[],
  view: { x0: number; y0: number; x1: number; y1: number },
): { x: number; y: number } | null {
  const seen = samples.filter(
    (p) => p.x >= view.x0 && p.x <= view.x1 && p.y >= view.y0 && p.y <= view.y1,
  );
  if (!seen.length) return null;
  const cx = seen.reduce((s, p) => s + p.x, 0) / seen.length;
  const cy = seen.reduce((s, p) => s + p.y, 0) / seen.length;
  return seen.reduce((best, p) =>
    Math.hypot(p.x - cx, p.y - cy) < Math.hypot(best.x - cx, best.y - cy) ? p : best,
  );
}

export const KEYPOINT_LABELS: Record<CalibrationId, string> = {
  cal20: '5/20',
  cal6: '13/6',
  cal3: '17/3',
  cal11: '8/11',
  bull: 'Bull',
};
