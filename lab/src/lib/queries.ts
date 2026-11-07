// Reads for Lab's pages: counts for the Overview, the Captures gallery, one capture for the
// label editor, and sessions.
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  ne,
  notInArray,
  sql,
} from 'drizzle-orm';

import { db } from './db/client';
import { defaultPoints, medianPoints, nearest, type GuessPoints, type PointGuess } from './guess';
import { BLIND_DISAGREED, CORRECTED, MODEL_WRONG, READ_FIXED } from './prefill';
import {
  captures,
  conditions,
  labelDarts,
  labelPoints,
  labels,
  models,
  prefillPoints,
  prefills,
  sessions,
  sessionTags,
  type SPLITS,
} from './db/schema';

export type SplitName = (typeof SPLITS)[number];

export interface OverviewCounts {
  captures: number;
  sessions: number;
  toReview: number;
  valuesOnly: number;
  /** Sent from Capture to label here. */
  unlabelled: number;
  rejected: number;
  bySplit: Record<SplitName, number>;
}

export function overviewCounts(): OverviewCounts {
  const d = db();
  const total = d.select({ n: count() }).from(captures).get()?.n ?? 0;
  const nSessions = d.select({ n: count() }).from(sessions).get()?.n ?? 0;
  const byStatus = d
    .select({ status: captures.status, n: count() })
    .from(captures)
    .groupBy(captures.status)
    .all();
  const toReview =
    d
      .select({ n: count() })
      .from(captures)
      .where(and(isNotNull(captures.review), ne(captures.status, 'rejected')))
      .get()?.n ?? 0;
  const bySplitRows = d
    .select({ split: sessions.split, n: count() })
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .where(notInArray(captures.status, ['rejected', 'unlabelled']))
    .groupBy(sessions.split)
    .all();
  const bySplit = { train: 0, val: 0, test: 0 };
  for (const r of bySplitRows) bySplit[r.split] = r.n;
  return {
    captures: total,
    sessions: nSessions,
    toReview,
    valuesOnly: byStatus.find((r) => r.status === 'values-only')?.n ?? 0,
    unlabelled: byStatus.find((r) => r.status === 'unlabelled')?.n ?? 0,
    rejected: byStatus.find((r) => r.status === 'rejected')?.n ?? 0,
    bySplit,
  };
}

export interface OverlayPoint {
  kind: string;
  x: number;
  y: number;
}
export interface OverlayDart {
  idx: number;
  entered: string | null;
  scored: string | null;
  x: number | null;
  y: number | null;
  onWire: boolean;
}

function overlaysFor(labelIds: number[]) {
  const d = db();
  const points = new Map<number, OverlayPoint[]>();
  const darts = new Map<number, OverlayDart[]>();
  if (!labelIds.length) return { points, darts };
  for (const p of d
    .select()
    .from(labelPoints)
    .where(inArray(labelPoints.labelId, labelIds))
    .all()) {
    points.set(p.labelId, [...(points.get(p.labelId) ?? []), { kind: p.kind, x: p.x, y: p.y }]);
  }
  for (const r of d
    .select()
    .from(labelDarts)
    .where(inArray(labelDarts.labelId, labelIds))
    .orderBy(asc(labelDarts.idx))
    .all()) {
    darts.set(r.labelId, [
      ...(darts.get(r.labelId) ?? []),
      { idx: r.idx, entered: r.entered, scored: r.scored, x: r.x, y: r.y, onWire: r.onWire },
    ]);
  }
  return { points, darts };
}

/** In the review queue, labels the player corrected from the model come first. */
// Corrected pre-fills, fixed reads and blind checks that disagreed lead the queue: each is a
// photo where the model went wrong.
const reviewRank = sql<number>`case when ${captures.review} like ${`%${CORRECTED}%`} or ${captures.review} like ${`%${READ_FIXED}%`} or ${captures.review} like ${`%${BLIND_DISAGREED}%`} then 0 else 1 end`;

export interface CaptureFilter {
  split?: SplitName;
  sessionId?: string;
  /** Only captures whose label needs a look. */
  review?: boolean;
  status?: 'labelled' | 'values-only' | 'unlabelled' | 'rejected';
  page?: number;
  pageSize?: number;
}

export interface CaptureCard {
  id: string;
  sessionId: string;
  split: SplitName;
  width: number;
  height: number;
  takenAt: number;
  status: string;
  review: string | null;
  angleDeg: number | null;
  dartCount: number;
  points: OverlayPoint[];
  darts: OverlayDart[];
}

function where(f: CaptureFilter) {
  return and(
    f.split ? eq(sessions.split, f.split) : undefined,
    f.sessionId ? eq(captures.sessionId, f.sessionId) : undefined,
    f.review ? and(isNotNull(captures.review), ne(captures.status, 'rejected')) : undefined,
    f.status ? eq(captures.status, f.status) : undefined,
  );
}

const cardColumns = {
  id: captures.id,
  sessionId: captures.sessionId,
  split: sessions.split,
  width: captures.width,
  height: captures.height,
  takenAt: captures.takenAt,
  status: captures.status,
  review: captures.review,
  labelId: captures.labelId,
  angleDeg: conditions.angleDeg,
  dartCount: conditions.dartCount,
};

function cardsOf(
  rows: {
    id: string;
    sessionId: string;
    split: SplitName;
    width: number;
    height: number;
    takenAt: Date;
    status: CaptureCard['status'];
    review: string | null;
    labelId: number | null;
    angleDeg: number | null;
    dartCount: number | null;
  }[],
): CaptureCard[] {
  const { points, darts } = overlaysFor(rows.flatMap((r) => (r.labelId ? [r.labelId] : [])));
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    split: r.split,
    width: r.width,
    height: r.height,
    takenAt: r.takenAt.getTime(),
    status: r.status,
    review: r.review,
    angleDeg: r.angleDeg,
    dartCount: r.dartCount ?? 0,
    points: r.labelId ? (points.get(r.labelId) ?? []) : [],
    darts: r.labelId ? (darts.get(r.labelId) ?? []) : [],
  }));
}

export function listCaptures(f: CaptureFilter = {}) {
  const d = db();
  const pageSize = f.pageSize ?? 24;
  const page = Math.max(1, f.page ?? 1);
  const total =
    d
      .select({ n: count() })
      .from(captures)
      .innerJoin(sessions, eq(captures.sessionId, sessions.id))
      .where(where(f))
      .get()?.n ?? 0;
  const rows = d
    .select(cardColumns)
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .leftJoin(conditions, eq(conditions.captureId, captures.id))
    .where(where(f))
    .orderBy(...(f.review ? [asc(reviewRank)] : []), desc(captures.takenAt), asc(captures.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();
  return { cards: cardsOf(rows), total, page, pageSize };
}

/** The gallery's views (all, a split, the review queue), counted under the other filters. */
export type CaptureView = 'all' | SplitName | 'review';

export function viewCounts(f: CaptureFilter): Record<CaptureView, number> {
  const rest = { sessionId: f.sessionId, status: f.status };
  const n = (g: CaptureFilter) =>
    db()
      .select({ n: count() })
      .from(captures)
      .innerJoin(sessions, eq(captures.sessionId, sessions.id))
      .where(where({ ...rest, ...g }))
      .get()?.n ?? 0;
  return {
    all: n({}),
    train: n({ split: 'train' }),
    val: n({ split: 'val' }),
    test: n({ split: 'test' }),
    review: n({ review: true }),
  };
}

/**
 * Where the shown captures' darts landed, by value ("T20", "D16", "5", "25", "Bull", "Miss",
 * "Bounce-out"): the value entered, else what its tip scores.
 */
export function hitCounts(f: CaptureFilter): { hits: Record<string, number>; darts: number } {
  const ids = db()
    .select({ labelId: captures.labelId })
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .where(and(where(f), isNotNull(captures.labelId)))
    .all()
    .map((r) => r.labelId!);
  const hits: Record<string, number> = {};
  let darts = 0;
  for (let i = 0; i < ids.length; i += 500) {
    for (const r of db()
      .select({ entered: labelDarts.entered, scored: labelDarts.scored })
      .from(labelDarts)
      .where(inArray(labelDarts.labelId, ids.slice(i, i + 500)))
      .all()) {
      const v = r.entered ?? r.scored;
      if (!v) continue;
      hits[v] = (hits[v] ?? 0) + 1;
      darts++;
    }
  }
  return { hits, darts };
}

export interface SessionGroup {
  session: { id: string; startedAt: number; split: SplitName; tags: string[] };
  /** Its captures shown, newest first, up to PER_SESSION. */
  cards: CaptureCard[];
  total: number;
}

/** Captures shown per session row; the rest are a link to the session. */
export const PER_SESSION = 40;

/** The shown captures a row per session, newest session first, a page of sessions at a time. */
export function listCaptureSessions(f: CaptureFilter = {}) {
  const d = db();
  const pageSize = f.pageSize ?? 6;
  const page = Math.max(1, f.page ?? 1);
  const all = d
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      split: sessions.split,
      n: count(),
    })
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .where(where(f))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.startedAt))
    .all();
  const shown = all.slice((page - 1) * pageSize, page * pageSize);
  const tags = new Map<string, string[]>();
  if (shown.length) {
    for (const t of d
      .select()
      .from(sessionTags)
      .where(
        inArray(
          sessionTags.sessionId,
          shown.map((s) => s.id),
        ),
      )
      .all()) {
      tags.set(t.sessionId, [...(tags.get(t.sessionId) ?? []), t.tag]);
    }
  }
  const rows: SessionGroup[] = shown.map((s) => {
    const cards = d
      .select(cardColumns)
      .from(captures)
      .innerJoin(sessions, eq(captures.sessionId, sessions.id))
      .leftJoin(conditions, eq(conditions.captureId, captures.id))
      .where(and(where(f), eq(captures.sessionId, s.id)))
      .orderBy(desc(captures.takenAt), asc(captures.id))
      .limit(PER_SESSION)
      .all();
    return {
      session: {
        id: s.id,
        startedAt: s.startedAt.getTime(),
        split: s.split,
        tags: tags.get(s.id) ?? [],
      },
      cards: cardsOf(cards),
      total: s.n,
    };
  });
  return { rows, total: all.length, page, pageSize };
}

export interface CaptureDetail extends CaptureCard {
  photo: string;
  zoom: number | null;
  deviceModel: string | null;
  typeId: string | null;
  prefillModel: string | null;
  missed: number;
  sessionStartedAt: number;
  tags: string[];
  conditions: {
    angleDeg: number | null;
    boardPx: number | null;
    brightness: number | null;
    tightGroup: boolean;
    fitResidualMm: number | null;
  } | null;
  history: { version: number; source: string; createdAt: number; current: boolean }[];
  /** The neighbouring captures in the same session, by time. */
  prevId: string | null;
  nextId: string | null;
  /** The next capture that needs a look, after this one. */
  nextReviewId: string | null;
  /** What the model pre-filled on the phone and how much of it the player kept. */
  prefill: CapturePrefill | null;
  /** A first guess at the board points, for Auto-place (guess.ts). */
  guess: PointGuess;
}

export interface CapturePrefill {
  model: string;
  accepted: boolean;
  boardKept: boolean;
  boardMovedMm: number | null;
  tipsNeeded: number;
  tipsPlaced: number;
  tipsKept: number;
  calibration: OverlayPoint[];
  tips: ({ x: number; y: number } | null)[];
}

function prefillOf(captureId: string, dartCount: number): CapturePrefill | null {
  const d = db();
  const p = d.select().from(prefills).where(eq(prefills.captureId, captureId)).get();
  if (!p) return null;
  const pts = d.select().from(prefillPoints).where(eq(prefillPoints.captureId, captureId)).all();
  const tips: CapturePrefill['tips'] = Array.from({ length: dartCount }, () => null);
  for (const t of pts) if (t.kind === 'tip') tips[t.idx] = { x: t.x, y: t.y };
  return {
    model: p.model,
    accepted: p.accepted,
    boardKept: p.boardKept,
    boardMovedMm: p.boardMovedMm,
    tipsNeeded: p.tipsNeeded,
    tipsPlaced: p.tipsPlaced,
    tipsKept: p.tipsKept,
    calibration: pts.flatMap((t) => (t.kind === 'tip' ? [] : [{ kind: t.kind, x: t.x, y: t.y }])),
    tips,
  };
}

export interface PrefillStats {
  model: string;
  visits: number;
  accepted: number;
  boardKept: number;
  tipsNeeded: number;
  tipsKept: number;
}

/** How much of each model's pre-fill players kept, in the order the models were trained. */
export function prefillStats(): PrefillStats[] {
  const d = db();
  const rows = d
    .select({
      model: prefills.model,
      visits: count(),
      accepted: sql<number>`sum(${prefills.accepted})`,
      boardKept: sql<number>`sum(${prefills.boardKept})`,
      tipsNeeded: sql<number>`sum(${prefills.tipsNeeded})`,
      tipsKept: sql<number>`sum(${prefills.tipsKept})`,
    })
    .from(prefills)
    .innerJoin(captures, eq(captures.id, prefills.captureId))
    .where(ne(captures.status, 'rejected'))
    .groupBy(prefills.model)
    .all();
  const order = new Map(
    d
      .select({ id: models.id, name: models.name })
      .from(models)
      .all()
      .map((m) => [m.name, m.id]),
  );
  // Models Lab trained in order; any other version (a bundled one, say) after them.
  return rows.sort(
    (a, b) =>
      (order.get(a.model) ?? Infinity) - (order.get(b.model) ?? Infinity) ||
      a.model.localeCompare(b.model),
  );
}

export function getCapture(id: string): CaptureDetail | null {
  const d = db();
  const r = d
    .select({ c: captures, s: sessions, k: conditions })
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .leftJoin(conditions, eq(conditions.captureId, captures.id))
    .where(eq(captures.id, id))
    .get();
  if (!r) return null;
  const { c, s, k } = r;
  const { points, darts } = overlaysFor(c.labelId ? [c.labelId] : []);
  const current = c.labelId
    ? d.select().from(labels).where(eq(labels.id, c.labelId)).get()
    : undefined;
  const history = d
    .select()
    .from(labels)
    .where(eq(labels.captureId, id))
    .orderBy(desc(labels.version))
    .all()
    .map((l) => ({
      version: l.version,
      source: l.source,
      createdAt: l.createdAt.getTime(),
      current: l.id === c.labelId,
    }));
  const tags = d
    .select({ tag: sessionTags.tag })
    .from(sessionTags)
    .where(eq(sessionTags.sessionId, s.id))
    .all()
    .map((t) => t.tag);
  const neighbour = (dir: 'prev' | 'next') =>
    d
      .select({ id: captures.id })
      .from(captures)
      .where(
        and(
          eq(captures.sessionId, s.id),
          dir === 'prev' ? lt(captures.takenAt, c.takenAt) : gt(captures.takenAt, c.takenAt),
        ),
      )
      .orderBy(dir === 'prev' ? desc(captures.takenAt) : asc(captures.takenAt))
      .limit(1)
      .get()?.id ?? null;
  const myRank = MODEL_WRONG.some((r) => c.review?.includes(r)) ? 0 : 1;
  const nextReview =
    d
      .select({ id: captures.id })
      .from(captures)
      .where(
        and(
          isNotNull(captures.review),
          ne(captures.status, 'rejected'),
          ne(captures.id, id),
          // After this one in the queue's order: rank, then newest first.
          sql`(${reviewRank} > ${myRank} or (${reviewRank} = ${myRank} and (${captures.takenAt} < ${c.takenAt.getTime()} or (${captures.takenAt} = ${c.takenAt.getTime()} and ${captures.id} > ${id}))))`,
        ),
      )
      .orderBy(asc(reviewRank), desc(captures.takenAt), asc(captures.id))
      .limit(1)
      .get()?.id ?? null;
  return {
    id: c.id,
    sessionId: s.id,
    split: s.split,
    width: c.width,
    height: c.height,
    takenAt: c.takenAt.getTime(),
    status: c.status,
    review: c.review,
    angleDeg: k?.angleDeg ?? null,
    dartCount: k?.dartCount ?? 0,
    points: c.labelId ? (points.get(c.labelId) ?? []) : [],
    darts: c.labelId ? (darts.get(c.labelId) ?? []) : [],
    photo: c.photo,
    zoom: c.zoom,
    deviceModel: c.deviceModel,
    typeId: c.typeId,
    prefillModel: c.prefillModel,
    missed: current?.missed ?? 0,
    sessionStartedAt: s.startedAt.getTime(),
    tags,
    conditions: k
      ? {
          angleDeg: k.angleDeg,
          boardPx: k.boardPx,
          brightness: k.brightness,
          tightGroup: k.tightGroup,
          fitResidualMm: k.fitResidualMm,
        }
      : null,
    history,
    prevId: neighbour('prev'),
    nextId: neighbour('next'),
    nextReviewId: nextReview,
    prefill: prefillOf(c.id, c.labelId ? (darts.get(c.labelId)?.length ?? 0) : 0),
    guess: pointGuess(c),
  };
}

/**
 * A first guess at a photo's board points (guess.ts), best source first: the board the model
 * placed on the phone; else the median of the labelled photos nearest in time in its session
 * (the phone tends to stay put through a session); else of other labelled photos the same size;
 * else a board square on in the middle.
 */
function pointGuess(c: {
  id: string;
  sessionId: string;
  width: number;
  height: number;
  takenAt: Date;
}): PointGuess {
  const d = db();
  const model = d
    .select({ kind: prefillPoints.kind, x: prefillPoints.x, y: prefillPoints.y })
    .from(prefillPoints)
    .where(and(eq(prefillPoints.captureId, c.id), ne(prefillPoints.kind, 'tip')))
    .all();
  if (model.length >= 4) {
    return {
      points: Object.fromEntries(model.map((p) => [p.kind, { x: p.x, y: p.y }])),
      from: 'model',
      photos: 1,
    };
  }
  const labelled = (where: ReturnType<typeof and>) => {
    const rows = d
      .select({
        id: captures.id,
        takenAt: captures.takenAt,
        kind: labelPoints.kind,
        x: labelPoints.x,
        y: labelPoints.y,
      })
      .from(captures)
      .innerJoin(labelPoints, eq(labelPoints.labelId, captures.labelId))
      .where(and(eq(captures.status, 'labelled'), ne(captures.id, c.id), where))
      .all();
    const byPhoto = new Map<string, { takenAt: number; points: GuessPoints }>();
    for (const r of rows) {
      const e = byPhoto.get(r.id) ?? { takenAt: r.takenAt.getTime(), points: {} };
      e.points[r.kind as keyof GuessPoints] = { x: r.x, y: r.y };
      byPhoto.set(r.id, e);
    }
    return nearest([...byPhoto.values()], c.takenAt.getTime());
  };
  const session = labelled(eq(captures.sessionId, c.sessionId));
  if (session.length) {
    return {
      points: medianPoints(session.map((p) => p.points)),
      from: 'session',
      photos: session.length,
    };
  }
  const similar = labelled(and(eq(captures.width, c.width), eq(captures.height, c.height)));
  if (similar.length) {
    return {
      points: medianPoints(similar.map((p) => p.points)),
      from: 'similar',
      photos: similar.length,
    };
  }
  return { points: defaultPoints(c.width, c.height), from: 'default', photos: 0 };
}

export interface SessionRow {
  id: string;
  startedAt: number;
  split: SplitName;
  source: string;
  device: string | null;
  captures: number;
  toReview: number;
  tags: string[];
}

export function listSessions(): SessionRow[] {
  const d = db();
  const rows = d
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      split: sessions.split,
      source: sessions.source,
      device: sessions.device,
      captures: count(captures.id),
      toReview: sql<number>`sum(case when ${captures.review} is not null and ${captures.status} != 'rejected' then 1 else 0 end)`,
    })
    .from(sessions)
    .leftJoin(captures, eq(captures.sessionId, sessions.id))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.startedAt))
    .all();
  const tags = new Map<string, string[]>();
  for (const t of d.select().from(sessionTags).all()) {
    tags.set(t.sessionId, [...(tags.get(t.sessionId) ?? []), t.tag]);
  }
  return rows.map((r) => ({
    ...r,
    startedAt: r.startedAt.getTime(),
    toReview: Number(r.toReview ?? 0),
    tags: tags.get(r.id) ?? [],
  }));
}

export interface WeekCount {
  /** Monday of the week (UTC), ms. */
  week: number;
  train: number;
  val: number;
  test: number;
}

/** Labelled photos (and values only) by the week they were taken, by set: the last `weeks`. */
export function labelledPerWeek(weeks = 12, now = Date.now()): WeekCount[] {
  const DAY = 86_400_000;
  const mondayOf = (t: number) => {
    const d = Math.floor(t / DAY);
    // 1970-01-01 was a Thursday: day 4 of a week starting Monday at 0.
    return (d - ((d + 3) % 7)) * DAY;
  };
  const last = mondayOf(now);
  const first = last - (weeks - 1) * 7 * DAY;
  const out: WeekCount[] = Array.from({ length: weeks }, (_, i) => ({
    week: first + i * 7 * DAY,
    train: 0,
    val: 0,
    test: 0,
  }));
  for (const r of db()
    .select({ takenAt: captures.takenAt, split: sessions.split })
    .from(captures)
    .innerJoin(sessions, eq(captures.sessionId, sessions.id))
    .where(inArray(captures.status, ['labelled', 'values-only']))
    .all()) {
    const i = (mondayOf(r.takenAt.getTime()) - first) / (7 * DAY);
    if (i >= 0 && i < weeks) out[i]![r.split]++;
  }
  return out;
}
