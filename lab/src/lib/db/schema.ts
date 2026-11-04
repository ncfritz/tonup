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

export const RUN_STATUS = ['queued', 'running', 'done', 'failed', 'cancelled'] as const;
export const MODEL_STATUS = ['candidate', 'active', 'retired'] as const;

/** A frozen copy of the dataset a run used: hard links to the photos and the labels as of then. */
export const snapshots = sqliteTable('snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  path: text('path').notNull(),
  train: integer('train').notNull(),
  val: integer('val').notNull(),
  test: integer('test').notNull(),
  /** Values-only captures in it (verification of visit totals only). */
  valuesOnly: integer('values_only').notNull(),
});

/** A training or verification run, run one at a time by the runner (lib/runner.ts). */
export const runs = sqliteTable(
  'runs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind', { enum: ['train', 'verify'] }).notNull(),
    status: text('status', { enum: RUN_STATUS }).notNull(),
    /** What it's doing now: snapshot, train, evaluate, export. */
    stage: text('stage'),
    /** The run's settings as JSON (epochs, learning rate, data); the one JSON column. */
    params: text('params').notNull(),
    snapshotId: integer('snapshot_id').references(() => snapshots.id),
    baseModelId: integer('base_model_id'),
    modelId: integer('model_id'),
    pid: integer('pid'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    /** Results on the verification set (or DeepDarts' test split before there is one). */
    evaluatedOn: text('evaluated_on'),
    samples: integer('samples'),
    visitCorrect: real('visit_correct'),
    dartCorrect: real('dart_correct'),
    boardFound: real('board_found'),
  },
  (t) => [index('runs_status').on(t.status)],
);

export const models = sqliteTable('models', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** v1, v2, … in order of training. */
  name: text('name').notNull().unique(),
  runId: integer('run_id').notNull(),
  status: text('status', { enum: MODEL_STATUS }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  /** Under the data folder: runs/<run>/best.pt and models/<id>/DartKeypoints.mlpackage. */
  checkpoint: text('checkpoint').notNull(),
  mlpackage: text('mlpackage'),
  evaluatedOn: text('evaluated_on'),
  samples: integer('samples'),
  visitCorrect: real('visit_correct'),
  dartCorrect: real('dart_correct'),
  boardFound: real('board_found'),
});

/** One model's totals in one verification (a verification run, or a training run's check). */
export const verifyResults = sqliteTable(
  'verify_results',
  {
    runId: integer('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    modelId: integer('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id').references(() => snapshots.id),
    samples: integer('samples').notNull(),
    /** Of those, values-only visits (judged on the visit total and segments only). */
    valuesOnly: integer('values_only').notNull(),
    visitCorrect: real('visit_correct').notNull(),
    dartCorrect: real('dart_correct').notNull(),
    boardFound: real('board_found').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.modelId] })],
);

/**
 * One photo in one verification: what the model got and the photo's conditions as they were
 * then (labels can change later; the breakdown should match the snapshot).
 */
export const verifyItems = sqliteTable(
  'verify_items',
  {
    runId: integer('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    modelId: integer('model_id')
      .notNull()
      .references(() => models.id, { onDelete: 'cascade' }),
    captureId: text('capture_id').notNull(),
    valuesOnly: integer('values_only', { mode: 'boolean' }).notNull(),
    boardFound: integer('board_found', { mode: 'boolean' }).notNull(),
    darts: integer('darts').notNull(),
    dartsRight: integer('darts_right').notNull(),
    visitCorrect: integer('visit_correct', { mode: 'boolean' }).notNull(),
    wantTotal: integer('want_total').notNull(),
    gotTotal: integer('got_total'),
    /** The model's points as JSON: { calibration: { cal20: [x, y], … }, tips: [[x, y], …] }. */
    predicted: text('predicted').notNull(),
    angleDeg: real('angle_deg'),
    /** The board's size across as a fraction of the photo's long side (how close it was). */
    boardFrac: real('board_frac'),
    brightness: real('brightness'),
    dartCount: integer('dart_count').notNull(),
    tightGroup: integer('tight_group', { mode: 'boolean' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.runId, t.modelId, t.captureId] })],
);

/** What the model pre-filled on the phone, against what the player confirmed (lib/prefill.ts). */
export const prefills = sqliteTable('prefills', {
  captureId: text('capture_id')
    .primaryKey()
    .references(() => captures.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  boardKept: integer('board_kept', { mode: 'boolean' }).notNull(),
  /** The furthest a board point moved, mm; null when one was dropped or added. */
  boardMovedMm: real('board_moved_mm'),
  tipsNeeded: integer('tips_needed').notNull(),
  tipsPlaced: integer('tips_placed').notNull(),
  tipsKept: integer('tips_kept').notNull(),
  /** Board and every tip kept: the player only confirmed. */
  accepted: integer('accepted', { mode: 'boolean' }).notNull(),
});

/** The model's proposed points: calibration keypoints (idx 0) and tips (idx = dart). */
export const prefillPoints = sqliteTable(
  'prefill_points',
  {
    captureId: text('capture_id')
      .notNull()
      .references(() => captures.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: [...KEYPOINTS, 'tip'] }).notNull(),
    idx: integer('idx').notNull(),
    x: real('x').notNull(),
    y: real('y').notNull(),
  },
  (t) => [primaryKey({ columns: [t.captureId, t.kind, t.idx] })],
);
