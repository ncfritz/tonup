// Board geometry (docs/plan/v1-implementation.md §3). Board space is millimetres with the bull
// at (0, 0) and the 20 straight up. Hit testing and scoring arrive in M1.

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

/**
 * The angle of a segment's centre in degrees, clockwise from straight up (the 20 is 0°).
 * Throws for a number that isn't on the board.
 */
export function segmentCentreDegrees(segment: number): number {
  const i = SEGMENT_ORDER.indexOf(segment as (typeof SEGMENT_ORDER)[number]);
  if (i < 0) throw new RangeError(`No segment ${segment} on the board`);
  return i * SEGMENT_DEGREES;
}
