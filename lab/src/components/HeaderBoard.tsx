// The header's board (mockups › Header C): half a dartboard in outline, rising from the bottom
// left corner behind the name. Monochrome, the edge heavier than the rest; drawn, not an image.

const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
/** Radii in mm on a real board, to the double's outer edge at 170. */
const RINGS = [6.35, 15.9, 99, 107, 162];
const EDGE = 170;
const NUMBER_RING = 212;

export function HeaderBoard({
  height,
  radius = 104,
  cx = 120,
}: {
  height: number;
  /** The double's outer edge, in px. */
  radius?: number;
  cx?: number;
}) {
  const k = radius / EDGE;
  const cy = height + 24;
  const at = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + r * k * Math.cos(a), cy + r * k * Math.sin(a)] as const;
  };
  const width = Math.ceil(cx + NUMBER_RING * k + 4);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
    >
      <g fill="none" stroke="#fff" strokeOpacity={0.24}>
        <circle cx={cx} cy={cy} r={NUMBER_RING * k} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={EDGE * k} strokeWidth={4} />
        {RINGS.map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r * k} strokeWidth={1} />
        ))}
        {NUMBERS.map((_, i) => {
          const [x0, y0] = at(15.9, 9 + 18 * i);
          const [x1, y1] = at(EDGE, 9 + 18 * i);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={1} />;
        })}
      </g>
      <g
        fill="#fff"
        fillOpacity={0.24}
        fontSize={22 * k}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {NUMBERS.map((n, i) => {
          const [x, y] = at(191, 18 * i);
          return (
            <text key={n} x={x} y={y}>
              {n}
            </text>
          );
        })}
      </g>
    </svg>
  );
}
