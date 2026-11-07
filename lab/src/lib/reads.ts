// Model reads (capture-lab.md › Model reads): on training sessions, once the active model is good
// enough, the phone shows the model's read of a visit (board, tips and values) for the player to
// confirm or fix, and one visit in N is a blind check (values entered first, the read after).
// Lab holds the settings, tells the phone each session's plan, compares each read with the label
// the player saved, and pauses reads when blind checks stop agreeing.
import { applyHomography, fitBoard, type ImagePoint } from '@domain/camera';
import { desc, eq, isNotNull } from 'drizzle-orm';

import { normaliseValue } from './conditions';
import { db } from './db/client';
import { captures, models, reads, sessions, settings } from './db/schema';
import type { LabelInput } from './labels';
import { BLIND_DISAGREED, MOVED_MM, READ_FIXED } from './prefill';

export { BLIND_DISAGREED, READ_FIXED };
import { splitOf, type Split } from './splits';

/** The active model's visit accuracy on verify that reads need (the ship bar). */
export const READ_BAR = 0.9;
/** Reads pause when blind checks agree on fewer than this share of the last AGREE_WINDOW. */
export const AGREE_BAR = 0.95;
export const AGREE_WINDOW = 50;
/** Fewer blind checks than this can't pause reads: too few to say. */
export const AGREE_MIN = 10;
/** A read tip and a label tip further apart than this (mm on the board) are different darts. */
export const PAIR_MM = 25;

export type ReadsMode = 'off' | 'train';

export interface ReadsSettings {
  mode: ReadsMode;
  /** One visit in this many is a blind check. */
  every: number;
}

export const READS_DEFAULTS: ReadsSettings = { mode: 'off', every: 10 };
const MODE_KEY = 'readsMode';
const EVERY_KEY = 'readsEvery';

export function readsSettings(): ReadsSettings {
  const rows = db().select().from(settings).all();
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const mode = get(MODE_KEY) === 'train' ? 'train' : 'off';
  const every = Number(get(EVERY_KEY));
  return {
    mode,
    every: Number.isInteger(every) && every >= 2 && every <= 100 ? every : READS_DEFAULTS.every,
  };
}

export function setReadsSettings(change: Partial<ReadsSettings>): ReadsSettings {
  const d = db();
  const put = (key: string, value: string) =>
    d
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run();
  if (change.mode) put(MODE_KEY, change.mode);
  if (change.every !== undefined) put(EVERY_KEY, String(Math.round(change.every)));
  return readsSettings();
}

export interface BlindAgreement {
  /** Blind checks in the window (the last AGREE_WINDOW). */
  checks: number;
  agreed: number;
  /** agreed ÷ checks, or null with none. */
  rate: number | null;
  /** Below AGREE_BAR with at least AGREE_MIN checks. */
  paused: boolean;
}

/** How the last AGREE_WINDOW blind checks came out. */
export function blindAgreement(): BlindAgreement {
  const rows = db()
    .select({ agreed: reads.blindAgreed })
    .from(reads)
    .innerJoin(captures, eq(captures.id, reads.captureId))
    .where(isNotNull(reads.blindAgreed))
    .orderBy(desc(captures.takenAt))
    .limit(AGREE_WINDOW)
    .all();
  const agreed = rows.filter((r) => r.agreed).length;
  const rate = rows.length ? agreed / rows.length : null;
  return {
    checks: rows.length,
    agreed,
    rate,
    paused: rows.length >= AGREE_MIN && rate !== null && rate < AGREE_BAR,
  };
}

export interface SessionPlan {
  sessionId: string;
  split: Split;
  reads: {
    on: boolean;
    every: number;
    /** The model to read with: the active one (the phone reads only with that version). */
    model: string | null;
    /** Why reads are off, or "on". */
    why: string;
  };
}

/** The active model and its visit accuracy on the verify set, if it's been verified. */
export function activeModel(): { name: string; visitCorrect: number | null } | null {
  const m = db()
    .select({ name: models.name, visit: models.visitCorrect, on: models.evaluatedOn })
    .from(models)
    .where(eq(models.status, 'active'))
    .get();
  if (!m) return null;
  return { name: m.name, visitCorrect: m.on?.startsWith('verify set') ? m.visit : null };
}

/**
 * What the phone should do for a session: its set (the one it has, or the one it will get, by the
 * same hash) and whether the model reads its visits. Reads need the setting on, a training
 * session (val and verify are never read), an active model at the bar, and blind checks agreeing.
 */
export function sessionPlan(sessionId: string): SessionPlan {
  const d = db();
  const known = d
    .select({ split: sessions.split })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();
  const split = known?.split ?? splitOf(sessionId);
  const s = readsSettings();
  const model = activeModel();
  const agree = blindAgreement();
  const why =
    s.mode === 'off'
      ? 'off in Lab'
      : split !== 'train'
        ? `a ${split === 'test' ? 'verify' : 'val'} session: values are entered first`
        : !model
          ? 'no active model'
          : model.visitCorrect === null
            ? `${model.name} isn't verified yet`
            : model.visitCorrect < READ_BAR
              ? `${model.name} is below the ${READ_BAR * 100}% visit bar`
              : agree.paused
                ? `paused: blind checks agree on ${Math.round((agree.rate ?? 0) * 100)}%`
                : 'on';
  return {
    sessionId,
    split,
    reads: { on: why === 'on', every: s.every, model: model?.name ?? null, why },
  };
}

export interface ReadDart {
  value: string;
  sure: boolean;
  tip: ImagePoint | null;
}

export interface ReadCheck {
  outcome: 'confirmed' | 'fixed';
  valuesChanged: number;
  tipsMoved: number;
  dartsAdded: number;
  dartsRemoved: number;
  wiresMarked: number;
  boardKept: boolean;
}

/**
 * The read against the label the player saved. The read's darts have no throwing order, so each
 * is paired with the label's dart nearest it on the board (within PAIR_MM); a pair whose value
 * differs is a changed value, and whose tip moved more than MOVED_MM a moved tip. A read dart
 * left over is a dart removed, unless a dart without a tip (a bounce-out, say) is left to take it,
 * which is a changed value; a label dart left over is a dart added. Confirmed means nothing
 * changed: the board kept, every value and tip as read, none flagged on the wire.
 */
export function checkRead(read: ReadDart[], label: LabelInput, boardKept: boolean): ReadCheck {
  const fit = fitBoard(label.points);
  const mm = (a: ImagePoint, b: ImagePoint) => {
    if (!fit) return Infinity;
    const p = applyHomography(fit.toBoard, a);
    const q = applyHomography(fit.toBoard, b);
    return Math.hypot(p.x - q.x, p.y - q.y);
  };
  const pairs: { r: number; l: number; d: number }[] = [];
  read.forEach((rd, r) =>
    label.darts.forEach((ld, l) => {
      if (rd.tip && ld.tip) {
        const d = mm(rd.tip, ld.tip);
        if (d <= PAIR_MM) pairs.push({ r, l, d });
      }
    }),
  );
  pairs.sort((a, b) => a.d - b.d);
  const usedR = new Set<number>();
  const usedL = new Set<number>();
  let valuesChanged = 0;
  let tipsMoved = 0;
  const same = (a: string | null, b: string | null) =>
    !!a && !!b && normaliseValue(a) === normaliseValue(b);
  for (const p of pairs) {
    if (usedR.has(p.r) || usedL.has(p.l)) continue;
    usedR.add(p.r);
    usedL.add(p.l);
    if (!same(read[p.r]!.value, label.darts[p.l]!.entered)) valuesChanged++;
    if (p.d > MOVED_MM) tipsMoved++;
  }
  // Read darts left: matched to a tipless label dart (it became a bounce-out), else removed.
  const tipless = label.darts.map((d, l) => l).filter((l) => !usedL.has(l) && !label.darts[l]!.tip);
  let dartsRemoved = 0;
  read.forEach((_, r) => {
    if (usedR.has(r)) return;
    const l = tipless.shift();
    if (l === undefined) return void dartsRemoved++;
    usedL.add(l);
    valuesChanged++;
  });
  const dartsAdded = label.darts.filter((_, l) => !usedL.has(l)).length;
  const wiresMarked = label.darts.filter((d) => d.onWire).length;
  const confirmed =
    boardKept &&
    valuesChanged === 0 &&
    tipsMoved === 0 &&
    dartsAdded === 0 &&
    dartsRemoved === 0 &&
    wiresMarked === 0;
  return {
    outcome: confirmed ? 'confirmed' : 'fixed',
    valuesChanged,
    tipsMoved,
    dartsAdded,
    dartsRemoved,
    wiresMarked,
    boardKept,
  };
}

/** Whether two visits' values agree, ignoring order (a read has none). */
export function sameValues(a: readonly string[], b: readonly string[]): boolean {
  const norm = (xs: readonly string[]) => xs.map(normaliseValue).sort().join(',');
  return norm(a) === norm(b);
}

export interface ReadsWeek {
  week: number;
  entered: number;
  confirmed: number;
  fixed: number;
  blind: number;
  /** Blind checks that agreed, of `blind`. */
  agreed: number;
}

export interface ReadsOverview {
  settings: ReadsSettings;
  /** Whether a training session starting now would be read, and why not. */
  status: SessionPlan['reads'];
  agreement: BlindAgreement;
  totals: { read: number; confirmed: number; fixed: number; blind: number; agreed: number };
  /** Median seconds per visit: read (confirmed or fixed), and entered first. */
  seconds: { read: number | null; entered: number | null };
  fixes: {
    valuesChanged: number;
    tipsMoved: number;
    wiresMarked: number;
    dartsAdded: number;
    dartsRemoved: number;
    boardRemarked: number;
  };
  weeks: ReadsWeek[];
}

const DAY = 86_400_000;
// 1970-01-01 was a Thursday: back to the Monday at 0.
const mondayOf = (t: number) => {
  const d = Math.floor(t / DAY);
  return (d - ((d + 3) % 7)) * DAY;
};

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
};

/** Overview › Model reads: the settings, whether reads are on, and how they've gone. */
export function readsOverview(weeks = 10, now = Date.now()): ReadsOverview {
  const d = db();
  const rows = d
    .select({
      takenAt: captures.takenAt,
      mode: captures.labelMode,
      seconds: captures.labelSeconds,
      outcome: reads.outcome,
      agreed: reads.blindAgreed,
      valuesChanged: reads.valuesChanged,
      tipsMoved: reads.tipsMoved,
      wiresMarked: reads.wiresMarked,
      dartsAdded: reads.dartsAdded,
      dartsRemoved: reads.dartsRemoved,
      boardKept: reads.boardKept,
    })
    .from(captures)
    .leftJoin(reads, eq(reads.captureId, captures.id))
    .where(isNotNull(captures.labelMode))
    .all();
  const last = mondayOf(now);
  const first = last - (weeks - 1) * 7 * DAY;
  const byWeek: ReadsWeek[] = Array.from({ length: weeks }, (_, i) => ({
    week: first + i * 7 * DAY,
    entered: 0,
    confirmed: 0,
    fixed: 0,
    blind: 0,
    agreed: 0,
  }));
  const totals = { read: 0, confirmed: 0, fixed: 0, blind: 0, agreed: 0 };
  const fixes = {
    valuesChanged: 0,
    tipsMoved: 0,
    wiresMarked: 0,
    dartsAdded: 0,
    dartsRemoved: 0,
    boardRemarked: 0,
  };
  const secs = { read: [] as number[], entered: [] as number[] };
  for (const r of rows) {
    const i = (mondayOf(r.takenAt.getTime()) - first) / (7 * DAY);
    const w = i >= 0 && i < weeks ? byWeek[i] : undefined;
    const isRead = r.mode === 'read' && r.outcome;
    if (r.mode === 'blind' && r.agreed !== null) {
      totals.blind++;
      if (r.agreed) totals.agreed++;
      if (w) {
        w.blind++;
        if (r.agreed) w.agreed++;
      }
    } else if (isRead) {
      totals.read++;
      totals[r.outcome!]++;
      if (w) w[r.outcome!]++;
    } else if (w) {
      w.entered++;
    }
    if (r.seconds !== null) (isRead ? secs.read : secs.entered).push(r.seconds);
    if (isRead && r.outcome === 'fixed') {
      fixes.valuesChanged += r.valuesChanged ?? 0;
      fixes.tipsMoved += r.tipsMoved ?? 0;
      fixes.wiresMarked += r.wiresMarked ?? 0;
      fixes.dartsAdded += r.dartsAdded ?? 0;
      fixes.dartsRemoved += r.dartsRemoved ?? 0;
      if (r.boardKept === false) fixes.boardRemarked++;
    }
  }
  return {
    settings: readsSettings(),
    status: sessionPlan(TRAIN_PROBE).reads,
    agreement: blindAgreement(),
    totals,
    seconds: { read: median(secs.read), entered: median(secs.entered) },
    fixes,
    weeks: byWeek,
  };
}

/** A session ID that hashes to the training set and is never shot, to ask "would it be read?". */
const TRAIN_PROBE = (() => {
  for (let i = 0; ; i++) if (splitOf(`reads-probe-${i}`) === 'train') return `reads-probe-${i}`;
})();
