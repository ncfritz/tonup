import Svg, { Circle, Path } from 'react-native-svg';

// Tab icons from the design canvas (24 pt grid, 2 pt round strokes). More are added as screens
// need them.
const paths = {
  practice: ['M4 20l7-7M14 4l6 6-6 2-2 6-6-6 6-2z', []],
  history: ['M4 20V10M10 20V4M16 20v-7M22 20H2', []],
  rules: ['M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5', []],
  settings: [
    'M4 7h10M18 7h2M4 17h4M12 17h8',
    [
      [16, 7, 2],
      [10, 17, 2],
    ],
  ],
  lock: ['M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3', []],
  info: ['M12 11v6M12 7.5v.5', [[12, 12, 9]]],
  chevron: ['M9 5l7 7-7 7', []],
  check: ['M5 12l4 4 10-10', []],
  // From the camera mockups: a body with a lens.
  camera: ['M3 8h3l2-3h8l2 3h3v11H3z', [[12, 13, 4]]],
  close: ['M6 6l12 12M18 6L6 18', []],
  search: ['M20 20l-4-4', [[11, 11, 7]]],
} as const satisfies Record<string, readonly [string, readonly (readonly number[])[]]>;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  color,
  size = 22,
  strokeWidth = 2,
}: {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const [d, circles] = paths[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Path d={d} />
      {circles.map(([cx, cy, r]) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </Svg>
  );
}
