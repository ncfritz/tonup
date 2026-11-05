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
  // Capture's Lab tabs: accuracy bars, a model (a cube), a training run (a pulse).
  overview: ['M4 20V12M10 20V6M16 20v-9M21 20H3', []],
  models: ['M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9', []],
  runs: ['M3 12h4l3-7 4 14 3-7h4', []],
  // Zoom in and out (Capture's photo).
  plus: ['M12 5v14M5 12h14', []],
  minus: ['M5 12h14', []],
  // Capture's session tags: the board light on and off, daylight, and where you stand (a board
  // above the oche, the dot at your spot).
  lightOn: [
    'M10 17h4M10.5 20h3M12 4a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9zM3 9h1.5M19.5 9H21M5 3.5l1 1M19 3.5l-1 1',
    [],
  ],
  lightOff: [
    'M10 17h4M10.5 20h3M12 4a5 5 0 0 0-3 9c.6.5 1 1.2 1 2h4c0-.8.4-1.5 1-2a5 5 0 0 0-3-9zM4 3l16 18',
    [],
  ],
  daylight: [
    'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
    [[12, 12, 4]],
  ],
  standLeft: [
    'M3 21h18',
    [
      [12, 7, 4],
      [5, 17, 1.5],
    ],
  ],
  standCentre: [
    'M3 21h18',
    [
      [12, 7, 4],
      [12, 17, 1.5],
    ],
  ],
  standRight: [
    'M3 21h18',
    [
      [12, 7, 4],
      [19, 17, 1.5],
    ],
  ],
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
