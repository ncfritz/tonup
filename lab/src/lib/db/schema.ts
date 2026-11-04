// Lab's database (capture-lab.md › Data). Photos live on disk under the data folder; these
// tables hold everything about them. Columns, not JSON blobs: a label is its points and darts.
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const SPLITS = ['train', 'val', 'test'] as const;
export const KEYPOINTS = ['cal20', 'cal6', 'cal3', 'cal11', 'bull'] as const;
export const CAPTURE_STATUS = ['labelled', 'values-only', 'rejected'] as const;

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  device: text('device'),
  /** train, val or test, fixed when Lab first sees the session (lib/splits.ts). */
  split: text('split', { enum: SPLITS }).notNull(),
  /** Where it came from: Ton Up Capture, or a captures folder imported from Ton Up. */
  source: text('source', { enum: ['capture', 'import'] })
    .notNull()
    .default('capture'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sessionTags = sqliteTable(
  'session_tags',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.tag] })],
);

export const captures = sqliteTable(
  'captures',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id),
    /** File name under <data>/photos (and <data>/thumbs). */
    photo: text('photo').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    takenAt: integer('taken_at', { mode: 'timestamp_ms' }).notNull(),
    zoom: real('zoom'),
    deviceModel: text('device_model'),
    /** The game or drill it was taken in (Ton Up captures). */
    typeId: text('type_id'),
    status: text('status', { enum: CAPTURE_STATUS }).notNull(),
    /** The model that pre-filled the label on the phone, if any. */
    prefillModel: text('prefill_model'),
    /** The current label version's id. */
    labelId: integer('label_id'),
    /** Why the current label needs a look (comma-separated reasons), or null. */
    review: text('review'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('captures_session').on(t.sessionId), index('captures_review').on(t.review)],
);

export const labels = sqliteTable(
  'labels',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    captureId: text('capture_id')
      .notNull()
      .references(() => captures.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    source: text('source', { enum: ['phone', 'import', 'lab'] }).notNull(),
    /** Darts the player said missed the board and aren't in the photo (Ton Up captures). */
    missed: integer('missed').notNull().default(0),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [uniqueIndex('labels_capture_version').on(t.captureId, t.version)],
);

export const labelPoints = sqliteTable(
  'label_points',
  {
    labelId: integer('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: KEYPOINTS }).notNull(),
    /** Normalised image coordinates, 0–1 from the top left. */
    x: real('x').notNull(),
    y: real('y').notNull(),
  },
  (t) => [primaryKey({ columns: [t.labelId, t.kind] })],
);

export const labelDarts = sqliteTable(
  'label_darts',
  {
    labelId: integer('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    /** What the player entered ("T20", "5", "Bull", "Miss", "Bounce-out"); null if not entered. */
    entered: text('entered'),
    /** The tip, normalised; null for a miss, a bounce-out or a values-only capture. */
    x: real('x'),
    y: real('y'),
    onWire: integer('on_wire', { mode: 'boolean' }).notNull().default(false),
    /** What the tip scores through the board fit, or null without a tip or a fit. */
    scored: text('scored'),
  },
  (t) => [primaryKey({ columns: [t.labelId, t.idx] })],
);

/** Measured from the photo and its current label, for coverage and breakdowns. */
export const conditions = sqliteTable('conditions', {
  captureId: text('capture_id')
    .primaryKey()
    .references(() => captures.id, { onDelete: 'cascade' }),
  /** How far off face-on the camera was, from the board's outline in the photo. */
  angleDeg: real('angle_deg'),
  /** The board's width across in the photo, in pixels. */
  boardPx: real('board_px'),
  /** Mean brightness 0–255. */
  brightness: real('brightness'),
  dartCount: integer('dart_count').notNull(),
  /** Two tips within TIGHT_GROUP_MM of each other. */
  tightGroup: integer('tight_group', { mode: 'boolean' }).notNull(),
  /** The board fit's worst keypoint error in mm. */
  fitResidualMm: real('fit_residual_mm'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
