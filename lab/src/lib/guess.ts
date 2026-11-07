// A first guess at a photo's board points, to drag into place rather than click from nothing
// (capture-lab.md › Pages › Capture › Auto-place). Plain functions over normalised photo
// coordinates (0–1 from the top left); the database part is pointGuess in queries.ts.
import { STEEL_TIP_RADII_MM as R } from '@domain/board';
import { boardPointOf, CALIBRATION_IDS, type CalibrationId, type ImagePoint } from '@domain/camera';

export type GuessPoints = Partial<Record<CalibrationId, ImagePoint>>;

/** Where a guess came from, best first. */
export type GuessSource = 'model' | 'session' | 'similar' | 'default';

export interface PointGuess {
  points: GuessPoints;
  from: GuessSource;
  /** Photos the guess is the median of (session, similar). */
  photos: number;
}

/** How many labelled photos, nearest in time, a session or similar guess takes the median of. */
export const GUESS_PHOTOS = 9;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Each point's median across the photos (a point only where at least one photo has it). */
export function medianPoints(photos: readonly GuessPoints[]): GuessPoints {
  const out: GuessPoints = {};
  for (const id of CALIBRATION_IDS) {
    const ps = photos.flatMap((p) => (p[id] ? [p[id]] : []));
    if (ps.length) out[id] = { x: median(ps.map((p) => p.x)), y: median(ps.map((p) => p.y)) };
  }
  return out;
}

/**
 * No photo to go by: the board square on, in the middle, its double ring across 60% of the
 * photo's shorter side.
 */
export function defaultPoints(width: number, height: number): GuessPoints {
  const s = (0.3 * Math.min(width, height)) / R.doubleOuter;
  const out: GuessPoints = {};
  for (const id of CALIBRATION_IDS) {
    const b = boardPointOf(id);
    out[id] = { x: 0.5 + (b.x * s) / width, y: 0.5 - (b.y * s) / height };
  }
  return out;
}

/**
 * Moves a guess onto the points already placed: with two or more in common, the rotation,
 * scale and shift that best fit them (least squares, in pixels); with one, just the shift.
 * Returns only the points not yet placed.
 */
export function alignGuess(
  guess: GuessPoints,
  placed: GuessPoints,
  width: number,
  height: number,
): GuessPoints {
  const px = (p: ImagePoint) => ({ x: p.x * width, y: p.y * height });
  const pairs = CALIBRATION_IDS.flatMap((id) =>
    guess[id] && placed[id] ? [{ g: px(guess[id]), p: px(placed[id]) }] : [],
  );
  let map = (q: { x: number; y: number }) => q;
  if (pairs.length === 1) {
    const { g, p } = pairs[0]!;
    map = (q) => ({ x: q.x + p.x - g.x, y: q.y + p.y - g.y });
  } else if (pairs.length >= 2) {
    // Similarity transform: p ≈ [a −b; b a] g + t.
    const n = pairs.length;
    const gc = {
      x: pairs.reduce((s, e) => s + e.g.x, 0) / n,
      y: pairs.reduce((s, e) => s + e.g.y, 0) / n,
    };
    const pc = {
      x: pairs.reduce((s, e) => s + e.p.x, 0) / n,
      y: pairs.reduce((s, e) => s + e.p.y, 0) / n,
    };
    let num1 = 0;
    let num2 = 0;
    let den = 0;
    for (const { g, p } of pairs) {
      const gx = g.x - gc.x;
      const gy = g.y - gc.y;
      const qx = p.x - pc.x;
      const qy = p.y - pc.y;
      num1 += gx * qx + gy * qy;
      num2 += gx * qy - gy * qx;
      den += gx * gx + gy * gy;
    }
    const a = den ? num1 / den : 1;
    const b = den ? num2 / den : 0;
    map = (q) => {
      const x = q.x - gc.x;
      const y = q.y - gc.y;
      return { x: a * x - b * y + pc.x, y: b * x + a * y + pc.y };
    };
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const out: GuessPoints = {};
  for (const id of CALIBRATION_IDS) {
    const g = guess[id];
    if (!g || placed[id]) continue;
    if (!pairs.length) {
      out[id] = g;
      continue;
    }
    const q = map(px(g));
    out[id] = { x: clamp(q.x / width), y: clamp(q.y / height) };
  }
  return out;
}

/** The labelled photos nearest in time to `at`, at most GUESS_PHOTOS. */
export function nearest<T extends { takenAt: number }>(photos: readonly T[], at: number): T[] {
  return [...photos]
    .sort((a, b) => Math.abs(a.takenAt - at) - Math.abs(b.takenAt - at))
    .slice(0, GUESS_PHOTOS);
}
