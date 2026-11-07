// Getting captures into Lab (capture-lab.md › Ton Up Lab): uploads from Ton Up Capture, folders
// of Ton Up's "Keep photos" captures, and new label versions from the editor. Every path ends in
// writeLabel, which stores the label and what Lab measures from it.
import fs from 'node:fs';
import path from 'node:path';

import { CALIBRATION_IDS } from '@domain/camera';
import { and, eq, max } from 'drizzle-orm';

import { measure } from './conditions';
import { db, type LabDb } from './db/client';
import {
  blindDarts,
  captures,
  conditions,
  labelDarts,
  prefillPoints,
  prefills,
  labelPoints,
  labels,
  readDarts,
  reads,
  sessions,
  sessionTags,
} from './db/schema';
import { captureFile, labelFromFile, type CaptureFile, type LabelInput } from './labels';
import {
  BLIND_DISAGREED,
  checkPrefill,
  CORRECTED,
  MODEL_WRONG,
  NOT_LABELLED,
  READ_FIXED,
} from './prefill';
import { checkRead } from './reads';
import { splitOf, type Split } from './splits';
import { photosDir, preparePhoto, savePhoto, thumbsDir } from './storage';

type Tx = Parameters<Parameters<LabDb['transaction']>[0]>[0];

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface IngestResult {
  id: string;
  sessionId: string;
  split: Split;
  /** False when Lab already had this capture (uploads are idempotent by ID). */
  created: boolean;
  /** A values-only capture it had, now labelled with tips: a new label version. */
  updated?: boolean;
}

export class IngestError extends Error {}

/** The session a file belongs to: Capture's own, or one per day for Ton Up's captures. */
function sessionOf(f: CaptureFile) {
  if (f.sessionId) return { id: f.sessionId, source: 'capture' as const };
  return { id: `tonup-${f.createdAt.slice(0, 10)}`, source: 'import' as const };
}

function captureIdOf(f: CaptureFile): string {
  const id = f.id ?? path.parse(f.image).name;
  if (!ID.test(id)) throw new IngestError(`Capture ID "${id}" isn't a plain ID`);
  return id;
}

function statusOf(input: LabelInput, valuesOnly: boolean) {
  const tips = input.darts.some((d) => d.tip);
  return valuesOnly || (!tips && input.darts.some((d) => d.entered)) ? 'values-only' : 'labelled';
}

/** Stores a label version and everything measured from it, and points the capture at it. */
function writeLabel(
  tx: Tx,
  capture: { id: string; width: number; height: number },
  input: LabelInput,
  source: 'phone' | 'import' | 'lab',
  now: Date,
  brightness?: number,
) {
  const [last] = tx
    .select({ v: max(labels.version) })
    .from(labels)
    .where(eq(labels.captureId, capture.id))
    .all();
  const version = (last?.v ?? 0) + 1;
  const m = measure(input, capture.width, capture.height);
  const [row] = tx
    .insert(labels)
    .values({ captureId: capture.id, version, source, missed: input.missed, createdAt: now })
    .returning({ id: labels.id })
    .all();
  const labelId = row!.id;
  const points = Object.entries(input.points).map(([kind, p]) => ({
    labelId,
    kind: kind as (typeof labelPoints.$inferInsert)['kind'],
    x: p.x,
    y: p.y,
  }));
  if (points.length) tx.insert(labelPoints).values(points).run();
  if (input.darts.length) {
    tx.insert(labelDarts)
      .values(
        input.darts.map((d, idx) => ({
          labelId,
          idx,
          entered: m.darts[idx]?.entered ?? null,
          x: d.tip?.x ?? null,
          y: d.tip?.y ?? null,
          onWire: d.onWire,
          scored: m.darts[idx]?.scored ?? null,
        })),
      )
      .run();
  }
  tx.update(captures)
    .set({ labelId, review: m.review.length ? m.review.join(', ') : null })
    .where(eq(captures.id, capture.id))
    .run();
  const measured = {
    angleDeg: m.angleDeg,
    boardPx: m.boardPx,
    dartCount: m.dartCount,
    tightGroup: m.tightGroup,
    fitResidualMm: m.fitResidualMm,
  };
  tx.insert(conditions)
    .values({ captureId: capture.id, brightness: brightness ?? null, ...measured })
    .onConflictDoUpdate({ target: conditions.captureId, set: measured })
    .run();
  return { labelId, version, measured: m };
}

/**
 * Adds one capture: its session (created with its split the first time Lab sees it), the photo
 * (upright, with a thumbnail) and label version 1. Does nothing for a capture Lab already has,
 * except a values-only one sent again from the phone with its tips, which gets a new version.
 */
export async function ingestCapture(
  rawMeta: unknown,
  photo: Buffer,
  source: 'phone' | 'import',
  now = new Date(),
): Promise<IngestResult> {
  const parsed = captureFile.safeParse(rawMeta);
  if (!parsed.success) {
    throw new IngestError(`Label file isn't valid: ${parsed.error.issues[0]?.message ?? ''}`);
  }
  const f = parsed.data;
  const id = captureIdOf(f);
  const session = sessionOf(f);
  if (!ID.test(session.id)) throw new IngestError(`Session ID "${session.id}" isn't a plain ID`);
  const d = db();

  const existing = d.select().from(captures).where(eq(captures.id, id)).get();
  if (existing) {
    const s = d.select().from(sessions).where(eq(sessions.id, existing.sessionId)).get();
    // Sent again labelled: a values-only photo with its tips, or a photo sent to label later now
    // labelled on the phone. The new label becomes the next version. Anything else sent again is
    // the same visit, and is ignored (a photo labelled here keeps Lab's label).
    const relabel =
      source === 'phone' &&
      !f.unlabelled &&
      ((existing.status === 'values-only' && !f.valuesOnly) || existing.status === 'unlabelled');
    if (relabel) {
      const input = labelFromFile(f);
      d.transaction((tx) => {
        const written = writeLabel(tx, existing, input, 'phone', now);
        tx.update(captures)
          .set({ status: statusOf(input, f.valuesOnly ?? false) })
          .where(eq(captures.id, id))
          .run();
        const boardKept = f.prefill ? checkPrefill(f.prefill, input).boardKept : true;
        howLabelled(tx, id, f, input, boardKept, written.measured.review);
      });
      return { id, sessionId: existing.sessionId, split: s!.split, created: false, updated: true };
    }
    return { id, sessionId: existing.sessionId, split: s!.split, created: false };
  }

  const prepared = await preparePhoto(photo);
  const name = `${id}.jpg`;
  savePhoto(name, prepared);
  const input = labelFromFile(f);
  const takenAt = new Date(f.createdAt);

  return d.transaction((tx) => {
    let s = tx.select().from(sessions).where(eq(sessions.id, session.id)).get();
    if (!s) {
      s = tx
        .insert(sessions)
        .values({
          id: session.id,
          startedAt: f.sessionStartedAt ? new Date(f.sessionStartedAt) : takenAt,
          device: f.deviceModel ?? null,
          split: splitOf(session.id),
          source: session.source,
          createdAt: now,
        })
        .returning()
        .get();
    }
    for (const tag of f.tags ?? []) {
      tx.insert(sessionTags).values({ sessionId: session.id, tag }).onConflictDoNothing().run();
    }
    tx.insert(captures)
      .values({
        id,
        sessionId: session.id,
        photo: name,
        width: prepared.width,
        height: prepared.height,
        takenAt: Number.isNaN(takenAt.getTime()) ? now : takenAt,
        zoom: f.zoom ?? null,
        deviceModel: f.deviceModel ?? null,
        typeId: f.typeId ?? null,
        status: f.unlabelled ? 'unlabelled' : statusOf(input, f.valuesOnly ?? false),
        prefillModel: f.prefillModel ?? f.modelVersion ?? null,
        createdAt: now,
      })
      .run();
    const written = writeLabel(
      tx,
      { id, width: prepared.width, height: prepared.height },
      input,
      source,
      now,
      prepared.brightness,
    );
    // To label here: in the review queue until it is.
    if (f.unlabelled) {
      tx.update(captures).set({ review: NOT_LABELLED }).where(eq(captures.id, id)).run();
    }
    if (f.prefill && f.prefillModel) {
      const check = checkPrefill(f.prefill, input);
      tx.insert(prefills)
        .values({ captureId: id, model: f.prefillModel, ...check })
        .run();
      const points = [
        ...f.prefill.calibration.flatMap((p, i) =>
          p ? [{ kind: CALIBRATION_IDS[i]!, idx: 0, x: p.x, y: p.y }] : [],
        ),
        ...f.prefill.tips.flatMap((p, i) =>
          p ? [{ kind: 'tip' as const, idx: i, x: p.x, y: p.y }] : [],
        ),
      ];
      if (points.length)
        tx.insert(prefillPoints)
          .values(points.map((p) => ({ captureId: id, ...p })))
          .run();
      // A label the player had to correct shows where the model goes wrong: queue it for a look.
      // (A read the player fixed is queued as that instead, by howLabelled.)
      if (!check.accepted && !f.read) {
        const review = [CORRECTED, ...written.measured.review].join(', ');
        tx.update(captures).set({ review }).where(eq(captures.id, id)).run();
      }
    }
    if (!f.unlabelled) {
      const boardKept = f.prefill ? checkPrefill(f.prefill, input).boardKept : true;
      howLabelled(tx, id, f, input, boardKept, written.measured.review);
    }
    return { id, sessionId: session.id, split: s.split, created: true };
  });
}

/**
 * How the phone's label was made (capture-lab.md › Model reads): the mode and time spent, and for
 * a model read, the read against the saved label (lib/reads.ts › checkRead) and any blind check.
 * A fixed read or a blind check that disagreed goes to To review.
 */
function howLabelled(
  tx: Tx,
  id: string,
  f: CaptureFile,
  input: LabelInput,
  boardKept: boolean,
  measuredReview: string[],
) {
  tx.update(captures)
    .set({ labelMode: f.labelMode ?? null, labelSeconds: f.seconds ?? null })
    .where(eq(captures.id, id))
    .run();
  tx.delete(reads).where(eq(reads.captureId, id)).run();
  tx.delete(readDarts).where(eq(readDarts.captureId, id)).run();
  tx.delete(blindDarts).where(eq(blindDarts.captureId, id)).run();
  if (!f.read || f.valuesOnly) return;
  const darts = f.read.darts.map((r) => ({
    value: r.value,
    sure: r.sure,
    tip: typeof r.x === 'number' && typeof r.y === 'number' ? { x: r.x, y: r.y } : null,
  }));
  const check = checkRead(darts, input, boardKept);
  tx.insert(reads)
    .values({
      captureId: id,
      model: f.read.model,
      ...check,
      blindAgreed: f.blind ? f.blind.agreed : null,
      blindChose: f.blind?.chose ?? null,
    })
    .run();
  if (darts.length)
    tx.insert(readDarts)
      .values(
        darts.map((r, idx) => ({
          captureId: id,
          idx,
          value: r.value,
          sure: r.sure,
          x: r.tip?.x ?? null,
          y: r.tip?.y ?? null,
        })),
      )
      .run();
  if (f.blind?.values.length)
    tx.insert(blindDarts)
      .values(f.blind.values.map((value, idx) => ({ captureId: id, idx, value })))
      .run();
  const extra = [
    ...(check.outcome === 'fixed' ? [READ_FIXED] : []),
    ...(f.blind && !f.blind.agreed ? [BLIND_DISAGREED] : []),
  ];
  if (extra.length)
    tx.update(captures)
      .set({ review: [...extra, ...measuredReview].join(', ') })
      .where(eq(captures.id, id))
      .run();
}

/** Saves a new label version from the editor. */
export function saveLabel(captureId: string, input: LabelInput, now = new Date()) {
  const d = db();
  const c = d.select().from(captures).where(eq(captures.id, captureId)).get();
  if (!c) throw new IngestError(`No capture ${captureId}`);
  return d.transaction((tx) => {
    const result = writeLabel(tx, c, input, 'lab', now);
    if (c.status !== 'rejected') {
      tx.update(captures)
        .set({ status: statusOf(input, false) })
        .where(eq(captures.id, captureId))
        .run();
    }
    return result;
  });
}

/** Leaves a capture out of training (or puts it back). */
export function setRejected(captureId: string, rejected: boolean) {
  const d = db();
  const c = d.select().from(captures).where(eq(captures.id, captureId)).get();
  if (!c) throw new IngestError(`No capture ${captureId}`);
  let status: (typeof captures.$inferSelect)['status'] = 'rejected';
  if (!rejected) {
    const tips = c.labelId
      ? d
          .select({ x: labelDarts.x })
          .from(labelDarts)
          .where(and(eq(labelDarts.labelId, c.labelId)))
          .all()
          .some((r) => r.x !== null)
      : false;
    status = (c.review ?? '').split(', ').includes(NOT_LABELLED)
      ? 'unlabelled'
      : tips
        ? 'labelled'
        : 'values-only';
  }
  d.update(captures).set({ status }).where(eq(captures.id, captureId)).run();
  return status;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: { file: string; error: string }[];
}

/**
 * Imports a folder of captures: each `<id>.json` beside the photo it names (Ton Up's
 * Documents/captures, copied off the phone through the Files app, or Capture's outbox).
 */
export async function importFolder(folder: string): Promise<ImportResult> {
  const dir = path.resolve(folder);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new IngestError(`No folder at ${dir}`);
  }
  const result: ImportResult = { imported: 0, skipped: 0, failed: [] };
  for (const file of fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as { image?: unknown };
      if (typeof meta.image !== 'string' || path.basename(meta.image) !== meta.image) {
        throw new IngestError('Its "image" isn\'t a file name in the same folder');
      }
      const photoPath = path.join(dir, meta.image);
      if (!fs.existsSync(photoPath)) throw new IngestError(`Photo ${meta.image} is missing`);
      const r = await ingestCapture(meta, fs.readFileSync(photoPath), 'import');
      if (r.created) result.imported++;
      else result.skipped++;
    } catch (e) {
      result.failed.push({ file, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

/**
 * A label where the model went wrong (a corrected pre-fill, a fixed read, a blind check that
 * disagreed), looked at and found right: drops those reasons from the review queue (any measured
 * reasons stay), without a new label version.
 */
export function confirmCorrected(captureId: string) {
  const d = db();
  const c = d.select().from(captures).where(eq(captures.id, captureId)).get();
  if (!c) throw new IngestError(`No capture ${captureId}`);
  const rest = (c.review ?? '')
    .split(', ')
    .filter((r) => r && !MODEL_WRONG.includes(r))
    .join(', ');
  d.update(captures)
    .set({ review: rest || null })
    .where(eq(captures.id, captureId))
    .run();
  return rest || null;
}

function removePhotoFiles(name: string) {
  for (const dir of [photosDir(), thumbsDir()]) fs.rmSync(path.join(dir, name), { force: true });
}

/**
 * Deletes a capture: its labels and everything measured from them, its photo and thumbnail.
 * Past runs keep what they used: their snapshots hold their own copies, and verification
 * results keep the photo's outcome (it just no longer shows in the worst-photos gallery).
 * Re-importing the same file, or Capture sending it again, brings it back as new.
 */
export function deleteCapture(captureId: string) {
  const d = db();
  const c = d.select().from(captures).where(eq(captures.id, captureId)).get();
  if (!c) throw new IngestError(`No capture ${captureId}`);
  d.delete(captures).where(eq(captures.id, captureId)).run();
  removePhotoFiles(c.photo);
  return { id: captureId, sessionId: c.sessionId };
}

/** Deletes a session and every capture in it (as deleteCapture does each). */
export function deleteSession(sessionId: string) {
  const d = db();
  const s = d.select().from(sessions).where(eq(sessions.id, sessionId)).get();
  if (!s) throw new IngestError(`No session ${sessionId}`);
  const photos = d
    .select({ photo: captures.photo })
    .from(captures)
    .where(eq(captures.sessionId, sessionId))
    .all();
  d.transaction((tx) => {
    tx.delete(captures).where(eq(captures.sessionId, sessionId)).run();
    tx.delete(sessions).where(eq(sessions.id, sessionId)).run();
  });
  for (const p of photos) removePhotoFiles(p.photo);
  return { id: sessionId, captures: photos.length };
}
