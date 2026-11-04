// The conditions Lab breaks accuracy and coverage down by (capture-lab.md › Data): camera
// angle, distance (board size in the photo), light, darts in the visit and tight groups. One
// set of buckets for the Overview's coverage and the Verification page's breakdown, so a thin
// bucket on one is the same bucket on the other.

export interface ConditionValues {
  angleDeg: number | null;
  /** Board size across as a fraction of the photo's long side. */
  boardFrac: number | null;
  brightness: number | null;
  dartCount: number;
  tightGroup: boolean;
}

export interface Condition {
  key: string;
  title: string;
  buckets: readonly string[];
  /** The bucket a photo falls in, or null when it wasn't measured (no board marks). */
  of: (c: ConditionValues) => string | null;
}

const by = (v: number | null, edges: number[], names: readonly string[]) => {
  if (v == null) return null;
  const i = edges.findIndex((e) => v < e);
  return names[i < 0 ? names.length - 1 : i]!;
};

const ANGLE = ['0–15°', '15–30°', '30–45°', '45°+'] as const;
const DISTANCE = ['Far (< 25%)', 'Mid (25–40%)', 'Near (40–60%)', 'Close (60%+)'] as const;
const LIGHT = ['Dim', 'Normal', 'Bright'] as const;
const DARTS = ['0', '1', '2', '3'] as const;
const GROUP = ['Spread', 'Tight group'] as const;

export const CONDITIONS: readonly Condition[] = [
  {
    key: 'angle',
    title: 'Camera angle',
    buckets: ANGLE,
    of: (c) => by(c.angleDeg, [15, 30, 45], ANGLE),
  },
  {
    key: 'distance',
    title: 'Board size in the photo',
    buckets: DISTANCE,
    of: (c) => by(c.boardFrac, [0.25, 0.4, 0.6], DISTANCE),
  },
  {
    key: 'light',
    title: 'Light',
    buckets: LIGHT,
    of: (c) => by(c.brightness, [70, 150], LIGHT),
  },
  {
    key: 'darts',
    title: 'Darts on the board',
    buckets: DARTS,
    of: (c) => DARTS[Math.min(3, Math.max(0, c.dartCount))]!,
  },
  {
    key: 'group',
    title: 'Grouping',
    buckets: GROUP,
    of: (c) => (c.dartCount < 2 ? null : c.tightGroup ? GROUP[1] : GROUP[0]),
  },
];

/** A bucket with too few photos to trust its numbers, or to have taught the model much. */
export const THIN = { total: 30, verify: 10 };
export const isThin = (total: number, verify: number) => total < THIN.total || verify < THIN.verify;

export const boardFrac = (boardPx: number | null, width: number, height: number) =>
  boardPx == null ? null : boardPx / Math.max(width, height);
