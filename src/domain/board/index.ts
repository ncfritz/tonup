// Board geometry (docs/plan/v1-implementation.md §3). Board space is millimetres with the bull
// at (0, 0), x to the right and y up, so the 20 is straight up. Every input method (tap, keypad,
// bot, and later the camera) is scored here (ADR 0005).
import { BULL, type BoardType, type Hit, type Point, type Target } from '../darts';

/** Segment numbers clockwise from the top. */
export const SEGMENT_ORDER = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const;

/** Each segment's width in degrees. */
export const SEGMENT_DEGREES = 360 / SEGMENT_ORDER.length;

/** Steel-tip ring radii in millimetres (ADR 0003). */
export const STEEL_TIP_RADII_MM = {
  innerBull: 6.35,
  outerBull: 15.9,
  trebleInner: 99,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
} as const;

export type RingRadii = typeof STEEL_TIP_RADII_MM;

export function radiiFor(board: BoardType): RingRadii {
  switch (board) {
    case 'steel':
      return STEEL_TIP_RADII_MM;
  }
}

/**
 * The angle of a segment's centre in degrees, clockwise from straight up (the 20 is 0°).
 * Throws for a number that isn't on the board.
 */
export function segmentCentreDegrees(segment: number): number {
  const i = SEGMENT_ORDER.indexOf(segment as (typeof SEGMENT_ORDER)[number]);
  if (i < 0) throw new RangeError(`No segment ${segment} on the board`);
  return i * SEGMENT_DEGREES;
}

/** The segment a direction points at, `deg` clockwise from straight up. */
export function segmentAtDegrees(deg: number): number {
  const i = Math.floor((((deg % 360) + 360 + SEGMENT_DEGREES / 2) % 360) / SEGMENT_DEGREES);
  return SEGMENT_ORDER[i % SEGMENT_ORDER.length]!;
}

/**
 * Scores a landing point. A point exactly on a wire goes to the inner region (a dart can't
 * land on a wire, so either side is acceptable; this keeps scoring deterministic).
 */
export function hitAt(p: Point, board: BoardType = 'steel'): Hit {
  const r = radiiFor(board);
  const d = Math.hypot(p.x, p.y);
  if (d <= r.innerBull) {
    return { segment: BULL, ring: 'innerBull', multiplier: 2, score: 50, isDouble: true };
  }
  if (d <= r.outerBull) {
    return { segment: BULL, ring: 'outerBull', multiplier: 1, score: 25, isDouble: false };
  }
  if (d > r.doubleOuter) {
    return { segment: 0, ring: 'miss', multiplier: 0, score: 0, isDouble: false };
  }
  const deg = (Math.atan2(p.x, p.y) * 180) / Math.PI;
  const segment = segmentAtDegrees(deg);
  if (d < r.trebleInner) {
    return { segment, ring: 'innerSingle', multiplier: 1, score: segment, isDouble: false };
  }
  if (d <= r.trebleOuter) {
    return { segment, ring: 'treble', multiplier: 3, score: segment * 3, isDouble: false };
  }
  if (d < r.doubleInner) {
    return { segment, ring: 'outerSingle', multiplier: 1, score: segment, isDouble: false };
  }
  return { segment, ring: 'double', multiplier: 2, score: segment * 2, isDouble: true };
}

/** The point `radius` mm out along `deg` clockwise from straight up. */
export function polar(radius: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: radius * Math.sin(rad), y: radius * Math.cos(rad) };
}

/**
 * The middle of a target's area: where keypad darts are drawn and where a bot aims.
 * A single aims at the fat outer single, nearer the treble where most players aim.
 */
export function centreOf(t: Target, board: BoardType = 'steel'): Point {
  const r = radiiFor(board);
  if (t.segment === BULL) {
    return t.multiplier === 2 ? { x: 0, y: 0 } : polar((r.innerBull + r.outerBull) / 2, 0);
  }
  const deg = segmentCentreDegrees(t.segment);
  const radius =
    t.multiplier === 3
      ? (r.trebleInner + r.trebleOuter) / 2
      : t.multiplier === 2
        ? (r.doubleInner + r.doubleOuter) / 2
        : (r.trebleOuter + r.doubleInner) / 2;
  return polar(radius, deg);
}

/**
 * Where to draw a dart: its landing point, or for a keypad dart the centre of what it hit.
 * Null for a keypad miss, which has nowhere on the board.
 */
export function drawPoint(d: {
  point: Point | null;
  hit: { segment: number; multiplier: number };
}): Point | null {
  if (d.point) return d.point;
  if (d.hit.multiplier === 0) return null;
  return centreOf({ segment: d.hit.segment, multiplier: d.hit.multiplier as 1 | 2 | 3 });
}
