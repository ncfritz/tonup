// Scoring from a photo (ADR 0011): a homography from the image to the board face, found from
// the four calibration points and the bull, and every dart tip mapped through it to millimetres
// and scored by the same geometry as tap and keypad input (src/domain/board).
import { hitAt, polar, SEGMENT_DEGREES, STEEL_TIP_RADII_MM as R } from '../board';
import type { Hit, Point } from '../darts';

/** A point in the photo, normalised: x from 0 (left) to 1, y from 0 (top) to 1. */
export interface ImagePoint {
  x: number;
  y: number;
}

/**
 * The keypoints the model finds and manual marking asks for: the four DeepDarts calibration
 * points, where these wires meet the outside of the double ring, and the bull.
 */
export const CALIBRATION = [
  { id: 'cal20', between: [20, 5], deg: -SEGMENT_DEGREES / 2 },
  { id: 'cal6', between: [6, 13], deg: 90 - SEGMENT_DEGREES / 2 },
  { id: 'cal3', between: [3, 17], deg: 180 - SEGMENT_DEGREES / 2 },
  { id: 'cal11', between: [11, 8], deg: 270 - SEGMENT_DEGREES / 2 },
] as const;
export type CalibrationId = (typeof CALIBRATION)[number]['id'] | 'bull';
export const CALIBRATION_IDS: CalibrationId[] = [...CALIBRATION.map((c) => c.id), 'bull'];

/** Where each calibration point is on the board face, in mm. */
export function boardPointOf(id: CalibrationId): Point {
  if (id === 'bull') return { x: 0, y: 0 };
  const c = CALIBRATION.find((k) => k.id === id)!;
  return polar(R.doubleOuter, c.deg);
}

/** Image to board: 3×3, row-major, h[8] = 1. */
export type Homography = readonly number[];

export function applyHomography(h: Homography, p: { x: number; y: number }): Point {
  const w = h[6]! * p.x + h[7]! * p.y + h[8]!;
  return { x: (h[0]! * p.x + h[1]! * p.y + h[2]!) / w, y: (h[3]! * p.x + h[4]! * p.y + h[5]!) / w };
}

/** Solves A·x = b by Gaussian elimination with partial pivoting; null if singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[p]![c]!)) p = r;
    if (Math.abs(m[p]![c]!) < 1e-12) return null;
    [m[c], m[p]] = [m[p]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/**
 * The homography taking `from` points to `to` points, from four or more pairs (least squares
 * beyond four). Null when the points are degenerate (three in a line, say).
 */
export function fitHomography(
  pairs: { from: { x: number; y: number }; to: { x: number; y: number } }[],
): Homography | null {
  if (pairs.length < 4) return null;
  // Normal equations of the linear (DLT) form with h[8] = 1.
  const ata = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => 0));
  const atb = Array.from({ length: 8 }, () => 0);
  const add = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      atb[i]! += row[i]! * rhs;
      for (let j = 0; j < 8; j++) ata[i]![j]! += row[i]! * row[j]!;
    }
  };
  for (const { from: f, to: t } of pairs) {
    add([f.x, f.y, 1, 0, 0, 0, -f.x * t.x, -f.y * t.x], t.x);
    add([0, 0, 0, f.x, f.y, 1, -f.x * t.y, -f.y * t.y], t.y);
  }
  const h = solve(ata, atb);
  return h ? [...h, 1] : null;
}

export interface BoardFit {
  /** Image (normalised) to board (mm). */
  toBoard: Homography;
  /** Board (mm) to image (normalised), for drawing the board outline on the photo. */
  toImage: Homography;
  /** How far, in mm, the furthest keypoint lands from where it should (0 with exactly four). */
  residual: number;
  /** How far each keypoint used lands from where it should, in mm: the largest is the suspect. */
  errors: Partial<Record<CalibrationId, number>>;
  /** Which keypoints the fit used. */
  used: CalibrationId[];
}

/** Above this the fit is suspect: a keypoint is off by more than a treble's width. */
export const MAX_RESIDUAL_MM = 8;

/** Fits the board from the calibration keypoints found (at least four of the five). */
export function fitBoard(points: Partial<Record<CalibrationId, ImagePoint>>): BoardFit | null {
  const used = CALIBRATION_IDS.filter((id) => points[id]);
  if (used.length < 4) return null;
  // Board mm scaled to about ±1 keeps the normal equations well conditioned.
  const S = R.doubleOuter;
  const pairs = used.map((id) => {
    const b = boardPointOf(id);
    return { from: points[id]!, to: { x: b.x / S, y: b.y / S } };
  });
  const scaled = fitHomography(pairs);
  const back = fitHomography(pairs.map((p) => ({ from: p.to, to: p.from })));
  if (!scaled || !back) return null;
  // Fold the scale into the matrices.
  const toBoard = scaled.map((v, i) => (i < 6 ? v * S : v));
  const toImage = back.map((v, i) => (i % 3 !== 2 ? v / S : v));
  const errors: Partial<Record<CalibrationId, number>> = {};
  for (const id of used) {
    const p = applyHomography(toBoard, points[id]!);
    const b = boardPointOf(id);
    errors[id] = Math.hypot(p.x - b.x, p.y - b.y);
  }
  const residual = Math.max(...used.map((id) => errors[id]!));
  return { toBoard, toImage, residual, errors, used };
}

/** Closer than this to a wire, a dart could be either side: the result screen asks. */
export const NEAR_WIRE_MM = 2;

/** How far a board point is from the nearest wire (ring or segment edge), in mm. */
export function wireDistance(p: Point): number {
  const r = Math.hypot(p.x, p.y);
  const rings = [
    R.innerBull,
    R.outerBull,
    R.trebleInner,
    R.trebleOuter,
    R.doubleInner,
    R.doubleOuter,
  ];
  const ring = Math.min(...rings.map((x) => Math.abs(r - x)));
  if (r <= R.outerBull || r > R.doubleOuter) return ring;
  // Segment edges sit every 18°, offset half a segment from straight up.
  const deg =
    ((Math.atan2(p.x, p.y) * 180) / Math.PI + 360 + SEGMENT_DEGREES / 2) % SEGMENT_DEGREES;
  const toEdge = Math.min(deg, SEGMENT_DEGREES - deg);
  return Math.min(ring, (toEdge * Math.PI * r) / 180);
}

export interface DartProposal {
  image: ImagePoint;
  point: Point;
  hit: Hit;
  /** 0–1 from the model; 1 for a dart the player placed. */
  confidence: number;
  nearWire: boolean;
}

export function propose(fit: BoardFit, image: ImagePoint, confidence = 1): DartProposal {
  const point = applyHomography(fit.toBoard, image);
  return {
    image,
    point,
    hit: hitAt(point),
    confidence,
    nearWire: wireDistance(point) < NEAR_WIRE_MM,
  };
}

/** Moves a proposal to a new spot in the photo (a drag on the result screen). */
export const moveTo = (fit: BoardFit, image: ImagePoint): DartProposal => propose(fit, image, 1);

/** Below this a detected dart is shown but flagged for a look. */
export const LOW_CONFIDENCE = 0.5;

/**
 * The darts for a visit from the tips found: the most confident `expected`, in reading order
 * (left to right), so the numbers on the photo are stable.
 */
export function pickDarts(
  fit: BoardFit,
  tips: { x: number; y: number; confidence: number }[],
  expected: number,
): DartProposal[] {
  return [...tips]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, expected)
    .sort((a, b) => a.x - b.x)
    .map((t) => propose(fit, { x: t.x, y: t.y }, t.confidence));
}
