import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// Tables: docs/plan/v1-implementation.md §4 and docs/architecture/data-model.md (ADR 0006).
// UUID text keys, epoch-millisecond UTC times, JSON in text columns validated in code.

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Local profiles for pass-and-play, and bots (no accounts, ADR 0001). */
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color'),
  /** 1–5 for a bot, null for a person. */
  botLevel: integer('bot_level'),
  createdAt: integer('created_at').notNull(),
  archivedAt: integer('archived_at'),
});

/** One game or drill. Everything about how it went is derived from its darts. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['game', 'drill'] }).notNull(),
    /** A game id ('x01', …) or a drill id. */
    typeId: text('type_id').notNull(),
    settings: text('settings').notNull(),
    boardType: text('board_type', { enum: ['steel'] }).notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    /** Set when a session is left unfinished on purpose, so Home doesn't offer to resume it. */
    abandonedAt: integer('abandoned_at'),
    result: text('result'),
  },
  (t) => [
    index('sessions_started_idx').on(t.startedAt),
    index('sessions_open_idx').on(t.endedAt, t.abandonedAt),
  ],
);

export const sessionPlayers = sqliteTable(
  'session_players',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.position] }),
    index('session_players_player_idx').on(t.playerId),
  ],
);

/** One row per dart (ADR 0006). */
export const darts = sqliteTable(
  'darts',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    playerId: text('player_id')
      .notNull()
      .references(() => players.id),
    /** Board position in mm; null for keypad darts. */
    x: real('x'),
    y: real('y'),
    segment: integer('segment').notNull(),
    ring: text('ring', {
      enum: ['miss', 'innerSingle', 'treble', 'outerSingle', 'double', 'outerBull', 'innerBull'],
    }).notNull(),
    multiplier: integer('multiplier').notNull(),
    score: integer('score').notNull(),
    isDouble: integer('is_double', { mode: 'boolean' }).notNull(),
    intendedSegment: integer('intended_segment'),
    intendedMultiplier: integer('intended_multiplier'),
    source: text('source', { enum: ['tap', 'keypad', 'bot', 'camera'] }).notNull(),
    precision: text('precision', { enum: ['exact', 'segment'] }).notNull(),
    corrected: integer('corrected', { mode: 'boolean' }).notNull(),
    at: integer('at').notNull(),
  },
  (t) => [
    uniqueIndex('darts_session_seq_idx').on(t.sessionId, t.seq),
    index('darts_player_idx').on(t.playerId, t.at),
  ],
);

/** Derived values, rebuildable from darts; cleared whenever a session's darts change. */
export const statsCache = sqliteTable(
  'stats_cache',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull(),
    key: text('key').notNull(),
    /** Bumped when the computation changes, so old values are ignored. */
    version: integer('version').notNull(),
    value: text('value').notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.playerId, t.key] })],
);

export const diagnosticsLog = sqliteTable(
  'diagnostics_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: integer('created_at').notNull(),
    level: text('level', { enum: ['error', 'warn', 'info'] }).notNull(),
    message: text('message').notNull(),
    context: text('context'),
  },
  (t) => [index('diagnostics_created_idx').on(t.createdAt)],
);

/**
 * Snap-to-score photos (ADR 0011): what was detected and what the player confirmed. The photo
 * itself is kept only with "Keep photos to improve detection" on, in Documents/captures.
 */
export const captures = sqliteTable(
  'captures',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    /** The seq of the first dart this photo scored. */
    firstSeq: integer('first_seq').notNull(),
    /** File name in Documents/captures, or null when the photo wasn't kept. */
    photo: text('photo'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    /** The model that read it, or null for marking by hand. */
    modelVersion: text('model_version'),
    /** JSON: what the model found. */
    detected: text('detected'),
    /** JSON: the confirmed labels (src/domain/camera/labels.ts). */
    labels: text('labels').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('captures_session_idx').on(t.sessionId)],
);
