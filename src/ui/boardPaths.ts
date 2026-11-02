import { SEGMENT_DEGREES, SEGMENT_ORDER } from '@/domain/board';

/** A point `r` from the centre at `deg` clockwise from straight up. */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

const f = (n: number) => Number(n.toFixed(3));

/** SVG path for a ring wedge between radii `r1` < `r2` from `fromDeg` to `toDeg` (clockwise). */
export function wedgePath(
  cx: number,
  cy: number,
  r1: number,
  r2: number,
  fromDeg: number,
  toDeg: number,
): string {
  const a = polar(cx, cy, r2, fromDeg);
  const b = polar(cx, cy, r2, toDeg);
  const c = polar(cx, cy, r1, toDeg);
  const d = polar(cx, cy, r1, fromDeg);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return (
    `M${f(a.x)} ${f(a.y)} A${r2} ${r2} 0 ${large} 1 ${f(b.x)} ${f(b.y)} ` +
    `L${f(c.x)} ${f(c.y)} A${r1} ${r1} 0 ${large} 0 ${f(d.x)} ${f(d.y)} Z`
  );
}

/** One wedge per segment for a ring, with the segment number and whether it's an "even" one. */
export function ringWedges(cx: number, cy: number, r1: number, r2: number) {
  return SEGMENT_ORDER.map((segment, i) => {
    const centre = i * SEGMENT_DEGREES;
    return {
      segment,
      // The 20 and every other segment from it are the dark ones on a real board.
      alt: i % 2 === 0,
      d: wedgePath(cx, cy, r1, r2, centre - SEGMENT_DEGREES / 2, centre + SEGMENT_DEGREES / 2),
    };
  });
}
