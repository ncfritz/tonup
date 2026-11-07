// Labelling one visit in Ton Up Capture (docs/plan/capture-lab.md › Ton Up Capture): enter
// what the darts scored, mark the board, tap each tip. Every tip is scored through the board
// fit and must match its value, or be flagged as on the wire, before the visit can be saved.
// On a training session where Lab has reads on, the model reads the visit instead and the player
// confirms or fixes it; one visit in N is a blind check (capture-lab.md › Model reads).
import {
  applyHomography,
  CALIBRATION_IDS,
  fitBoard,
  MAX_RESIDUAL_MM,
  propose,
  type BoardFit,
  type CalibrationId,
  type ImagePoint,
} from '@/domain/camera';
import { label } from '@/domain/darts';
import type { DetectResult } from '@/services/vision';

export interface Photo {
  uri: string;
  width: number;
  height: number;
}

/** A dart as entered: the scorer's label ("T20", "5", "25", "Bull"), or a dart with no tip. */
export type Entered = string;
export const MISS = 'Miss';
export const BOUNCE_OUT = 'Bounce-out';
const TIPLESS = new Set([MISS, BOUNCE_OUT]);
export const needsTip = (e: Entered) => !TIPLESS.has(e);

/** Darts in a visit. */
export const MAX_DARTS = 3;

/** `read`: the model's read to confirm or fix; `disagree`: a blind check that didn't match. */
export type Step = 'values' | 'board' | 'tips' | 'review' | 'read' | 'disagree';

/** How the label is being made: values entered first, the model's read, or a blind check. */
export type LabelMode = 'entered' | 'read' | 'blind';

/** A dart as the model read it: its value through the board fit, how sure, and its tip. */
export interface ReadDart {
  value: Entered;
  tip: ImagePoint;
  /** Confident, and not near a wire. */
  sure: boolean;
  /** Why not sure: the tip is near a wire, or the model barely saw it. */
  doubt: 'nearWire' | 'faint' | null;
}

export interface VisitState {
  photo: Photo;
  detected: DetectResult | null;
  step: Step;
  entered: Entered[];
  calibration: Partial<Record<CalibrationId, ImagePoint>>;
  /** Next calibration point when marking by hand; null when the board is marked. */
  marking: number | null;
  markFailed: boolean;
  fit: BoardFit | null;
  /** The board's points came from the model (and haven't been re-marked). */
  boardFromModel: boolean;
  /** One per entered dart; null until tapped (and always null for Miss and Bounce-out). */
  tips: (ImagePoint | null)[];
  onWire: boolean[];
  /** The dart a tap on the photo places or moves. */
  selected: number | null;
  /** How many tips the model placed. */
  tipsFromModel: number;
  /**
   * What the model placed, as it placed it (later edits don't change this), so Lab can tell a
   * pre-fill the player only confirmed from one they corrected. Null without a usable board.
   */
  proposal: {
    calibration: Partial<Record<CalibrationId, ImagePoint>>;
    /** One per entered dart once tips are pre-filled. */
    tips: (ImagePoint | null)[];
  } | null;
  mode: LabelMode;
  /** The model's read (in no throwing order), once it has read the visit. */
  read: ReadDart[] | null;
  /** A blind check: the values entered before the read was shown, and how it came out. */
  blind: { values: Entered[]; agreed: boolean; chose?: 'mine' | 'model' } | null;
  /** Anything changed from the read (a value, a tip, a dart, the wire, the board). */
  edited: boolean;
  /** When the photo was taken, to time the visit (ms). */
  startedAt: number;
}

const MIN_CONFIDENCE = 0.3;

/** Starts on a new photo; the model's board, if it found one, is kept for the board step. */
export function start(photo: Photo, detected: DetectResult | null, now = Date.now()): VisitState {
  const base: VisitState = {
    photo,
    detected,
    step: 'values',
    entered: [],
    calibration: {},
    marking: 0,
    markFailed: false,
    fit: null,
    boardFromModel: false,
    tips: [],
    onWire: [],
    selected: null,
    tipsFromModel: 0,
    proposal: null,
    mode: 'entered',
    read: null,
    blind: null,
    edited: false,
    startedAt: now,
  };
  if (!detected) return base;
  const calibration: Partial<Record<CalibrationId, ImagePoint>> = {};
  for (const id of CALIBRATION_IDS) {
    const k = detected.keypoints[id];
    if (k && k.c >= MIN_CONFIDENCE) calibration[id] = { x: k.x, y: k.y };
  }
  const fit = fitBoard(calibration);
  if (!fit || fit.residual > MAX_RESIDUAL_MM) return base;
  return {
    ...base,
    calibration,
    fit,
    marking: null,
    boardFromModel: true,
    proposal: { calibration, tips: [] },
  };
}

/**
 * Picks up a visit saved earlier (a values-only one, to add its tips): its values, and its
 * board when it was marked, on the values step so they can be checked first.
 */
export function resume(photo: Photo, saved: LabelFile): VisitState {
  const s = start(photo, null);
  const calibration: Partial<Record<CalibrationId, ImagePoint>> = {};
  CALIBRATION_IDS.forEach((id, i) => {
    const p = saved.calibration[i];
    if (p) calibration[id] = { x: p.x, y: p.y };
  });
  const fit = fitBoard(calibration);
  const marked = !!fit && fit.residual <= MAX_RESIDUAL_MM;
  return {
    ...s,
    entered: saved.darts.slice(0, MAX_DARTS).map((d) => d.value),
    ...(marked ? { calibration, fit, marking: null } : {}),
  };
}

// Values

export function enter(s: VisitState, value: Entered): VisitState {
  if (s.step !== 'values' || s.entered.length >= MAX_DARTS) return s;
  return { ...s, entered: [...s.entered, value] };
}

export const undoEnter = (s: VisitState): VisitState =>
  s.step === 'values' ? { ...s, entered: s.entered.slice(0, -1) } : s;

export const canLeaveValues = (s: VisitState) => s.entered.length > 0;

/** Values done: on to the board (or straight to review when no dart has a tip to tap). */
export function toBoard(s: VisitState): VisitState {
  if (!canLeaveValues(s)) return s;
  const tips = s.entered.map((_, i) => s.tips[i] ?? null);
  const onWire = s.entered.map((_, i) => s.onWire[i] ?? false);
  return { ...s, step: 'board', tips, onWire };
}

// Board

/** The point a hand-marking step asks for. */
export const markingPoint = (s: VisitState): CalibrationId | null =>
  s.marking === null ? null : (CALIBRATION_IDS[s.marking] ?? null);

export function tapBoard(s: VisitState, p: ImagePoint): VisitState {
  if (s.step !== 'board' || s.marking === null) return s;
  const id = CALIBRATION_IDS[s.marking]!;
  const calibration = { ...s.calibration, [id]: p };
  const next = s.marking + 1;
  if (next < CALIBRATION_IDS.length) {
    return { ...s, calibration, marking: next, markFailed: false };
  }
  const fit = fitBoard(calibration);
  if (!fit || fit.residual > MAX_RESIDUAL_MM) {
    // Points that don't make a board (out of order, say): mark again from the first.
    return { ...s, calibration: {}, fit: null, marking: 0, markFailed: true };
  }
  return { ...s, calibration, fit, marking: null, markFailed: false };
}

/** Marks the board again by hand (the model's points looked wrong). */
export const remark = (s: VisitState): VisitState => ({
  ...s,
  edited: true,
  calibration: {},
  fit: null,
  marking: 0,
  markFailed: false,
  boardFromModel: false,
});

/** Board done: on to the tips, with any the model found pre-placed. */
export function toTips(s: VisitState): VisitState {
  if (!s.fit) return s;
  let next: VisitState = { ...s, step: 'tips' };
  if (s.boardFromModel && s.tips.every((t) => t === null)) next = prefillTips(next);
  return { ...next, selected: firstMissing(next) };
}

/**
 * Places the model's tips: each dart takes an unused tip that scores what was entered, then
 * any left over go to darts still without one, most confident first.
 */
function prefillTips(s: VisitState): VisitState {
  const fit = s.fit;
  if (!fit || !s.detected) return s;
  const found = s.detected.tips
    .filter((t) => t.c >= MIN_CONFIDENCE)
    .sort((a, b) => b.c - a.c)
    .map((t) => ({ image: { x: t.x, y: t.y }, scored: label(propose(fit, t).hit) }));
  const used = new Set<number>();
  const tips = [...s.tips];
  s.entered.forEach((e, i) => {
    if (!needsTip(e)) return;
    const j = found.findIndex((f, k) => !used.has(k) && f.scored === e);
    if (j >= 0) {
      used.add(j);
      tips[i] = found[j]!.image;
    }
  });
  s.entered.forEach((e, i) => {
    if (!needsTip(e) || tips[i]) return;
    const j = found.findIndex((_, k) => !used.has(k));
    if (j >= 0) {
      used.add(j);
      tips[i] = found[j]!.image;
    }
  });
  return {
    ...s,
    tips,
    tipsFromModel: used.size,
    proposal: s.proposal ? { ...s.proposal, tips } : s.proposal,
  };
}

// Tips

const firstMissing = (s: VisitState): number | null => {
  const i = s.entered.findIndex((e, k) => needsTip(e) && !s.tips[k]);
  return i >= 0 ? i : null;
};

/** A tap on the photo in the tips step: places (or moves) the selected dart's tip. */
export function tapTip(s: VisitState, p: ImagePoint): VisitState {
  if (s.step !== 'tips' && s.step !== 'read') return s;
  const target = s.selected ?? firstMissing(s);
  if (target === null) return s;
  const tips = s.tips.map((t, i) => (i === target ? p : t));
  const next = { ...s, tips, edited: s.edited || s.step === 'read' };
  // On the read, the dart stays picked: its tip may need another nudge.
  return s.step === 'read' ? next : { ...next, selected: firstMissing(next) };
}

export const selectDart = (s: VisitState, i: number | null): VisitState => ({
  ...s,
  selected: i !== null && needsTip(s.entered[i] ?? MISS) ? (s.selected === i ? null : i) : null,
});

export const toggleWire = (s: VisitState, i: number): VisitState => ({
  ...s,
  onWire: s.onWire.map((w, k) => (k === i ? !w : w)),
  edited: s.edited || s.mode !== 'entered',
});

export interface DartCheck {
  entered: Entered;
  needsTip: boolean;
  tip: ImagePoint | null;
  /** What the tip scores through the board fit. */
  scored: string | null;
  match: boolean;
  onWire: boolean;
  nearWire: boolean;
  /** Placed by the model and not moved. */
  ok: boolean;
}

export function checks(s: VisitState): DartCheck[] {
  return s.entered.map((entered, i) => {
    const tip = s.tips[i] ?? null;
    const tipNeeded = needsTip(entered);
    const p = s.fit && tip ? propose(s.fit, tip) : null;
    const scored = p ? label(p.hit) : null;
    const match = !tipNeeded || scored === entered;
    const onWire = s.onWire[i] ?? false;
    return {
      entered,
      needsTip: tipNeeded,
      tip,
      scored,
      match,
      onWire,
      nearWire: p?.nearWire ?? false,
      ok: !tipNeeded || (!!tip && (match || onWire)),
    };
  });
}

/** Every dart has its tip, and every tip scores its value or is flagged on the wire. */
export const canReview = (s: VisitState) => !!s.fit && checks(s).every((c) => c.ok);

export const toReview = (s: VisitState): VisitState =>
  canReview(s) ? { ...s, step: 'review', selected: null } : s;

/** Back one step, keeping what was done. */
export function back(s: VisitState): VisitState {
  // From a read reached by "Enter it myself" or a blind check, review goes back to the read.
  if (s.step === 'review' && s.read && s.mode !== 'entered' && !s.edited)
    return { ...s, step: 'read' };
  if (s.step === 'review') return { ...s, step: 'tips' };
  if (s.step === 'disagree') return { ...s, step: 'values', blind: null };
  // A blind check's read: back to the values as entered, to change them before the read shows.
  if (s.step === 'read' && s.mode === 'blind' && s.blind) {
    return {
      ...s,
      step: 'values',
      entered: s.blind.values,
      tips: [],
      onWire: [],
      selected: null,
      blind: null,
      edited: false,
      tipsFromModel: 0,
      proposal: s.proposal ? { ...s.proposal, tips: [] } : s.proposal,
    };
  }
  if (s.step === 'tips') return { ...s, step: 'board', selected: null };
  if (s.step === 'board') return { ...s, step: 'values' };
  return s;
}

// Model reads (capture-lab.md › Model reads)

/** A tip the model is at least this confident of is "sure", unless it's near a wire. */
export const SURE = 0.6;

/**
 * The model's read of the visit: up to three darts, most confident first, each scored through the
 * board it found. Null without the model's board or with no dart found: then the values are
 * entered as usual.
 */
export function readOf(s: VisitState): ReadDart[] | null {
  const fit = s.fit;
  if (!fit || !s.boardFromModel || !s.detected) return null;
  const darts = s.detected.tips
    .filter((t) => t.c >= MIN_CONFIDENCE)
    .sort((a, b) => b.c - a.c)
    .slice(0, MAX_DARTS)
    .map((t) => {
      const p = propose(fit, { x: t.x, y: t.y });
      const doubt = p.nearWire ? ('nearWire' as const) : t.c < SURE ? ('faint' as const) : null;
      return { value: label(p.hit), tip: { x: t.x, y: t.y }, sure: !doubt, doubt };
    });
  return darts.length ? darts : null;
}

/** Puts the read on screen as the visit: its values and tips, for the player to check. */
function showRead(s: VisitState, read: ReadDart[]): VisitState {
  const tips = read.map((r) => r.tip);
  return {
    ...s,
    step: 'read',
    read,
    entered: read.map((r) => r.value),
    tips,
    onWire: read.map(() => false),
    selected: null,
    tipsFromModel: tips.length,
    proposal: s.proposal ? { ...s.proposal, tips } : s.proposal,
  };
}

/**
 * Starts a visit the model reads (a training session with reads on): straight to the read. Stays
 * on entering the values when the model has no read of it.
 */
export function startRead(s: VisitState): VisitState {
  const read = readOf(s);
  return read ? { ...showRead(s, read), mode: 'read' } : s;
}

/** Starts a blind check: the values are entered first, the read shown after (revealRead). */
export const startBlind = (s: VisitState): VisitState => (readOf(s) ? { ...s, mode: 'blind' } : s);

/** Whether two visits' values agree, whatever the order (a read has none). */
export const sameValues = (a: readonly Entered[], b: readonly Entered[]) =>
  [...a].sort().join(',') === [...b].sort().join(',');

/**
 * A blind check's values are in: show the read. If it agrees with them, the read is the visit to
 * confirm; if not, the player says which is right first (the disagree step).
 */
export function revealRead(s: VisitState): VisitState {
  if (s.mode !== 'blind' || s.step !== 'values' || !canLeaveValues(s)) return s;
  const read = readOf(s);
  if (!read) return toBoard({ ...s, mode: 'entered' });
  const values = [...s.entered];
  const agreed = sameValues(
    values,
    read.map((r) => r.value),
  );
  if (agreed) return { ...showRead(s, read), blind: { values, agreed } };
  return { ...s, step: 'disagree', read, blind: { values, agreed } };
}

/** After a disagreement: the player's values were right. On to the board, then their tips. */
export const chooseMine = (s: VisitState): VisitState =>
  s.step === 'disagree' && s.blind
    ? toBoard({ ...s, blind: { ...s.blind, chose: 'mine' }, edited: true })
    : s;

/** After a disagreement: the model's read was right (or the start of fixing it). */
export const chooseModel = (s: VisitState): VisitState =>
  s.step === 'disagree' && s.blind && s.read
    ? { ...showRead(s, s.read), blind: { ...s.blind, chose: 'model' } }
    : s;

/** Fixing a dart on the read: a new value (a tipless one drops its tip). */
export function setValue(s: VisitState, i: number, value: Entered): VisitState {
  if (s.step !== 'read' || i < 0 || i >= s.entered.length) return s;
  return {
    ...s,
    entered: s.entered.map((e, k) => (k === i ? value : e)),
    tips: s.tips.map((t, k) => (k === i ? (needsTip(value) ? t : null) : t)),
    onWire: s.onWire.map((w, k) => (k === i && !needsTip(value) ? false : w)),
    edited: s.edited || value !== s.entered[i],
  };
}

/** Fixing the read: that wasn't a dart. */
export function removeDart(s: VisitState, i: number): VisitState {
  if (s.step !== 'read' || i < 0 || i >= s.entered.length) return s;
  const drop = <T>(xs: T[]) => xs.filter((_, k) => k !== i);
  return {
    ...s,
    entered: drop(s.entered),
    tips: drop(s.tips),
    onWire: drop(s.onWire),
    selected: null,
    proposal: s.proposal ? { ...s.proposal, tips: drop(s.proposal.tips) } : s.proposal,
    edited: true,
  };
}

/** Fixing the read the long way: today's steps, from the values, with the read's kept. */
export const enterMyself = (s: VisitState): VisitState =>
  s.step === 'read' ? { ...s, step: 'values', selected: null, edited: true } : s;

/**
 * What a dart might have scored instead: the beds a few millimetres around its tip (the ones
 * across the nearest wires), at most three.
 */
export function alternatives(s: VisitState, i: number): Entered[] {
  const tip = s.tips[i];
  const fit = s.fit;
  if (!tip || !fit) return [];
  const at = applyHomography(fit.toBoard, tip);
  const current = s.entered[i];
  const out: Entered[] = [];
  for (const r of [2, 4, 7]) {
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const q = applyHomography(fit.toImage, {
        x: at.x + r * Math.cos(a),
        y: at.y + r * Math.sin(a),
      });
      const v = label(propose(fit, q).hit);
      if (v !== current && !out.includes(v)) out.push(v);
    }
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}

/**
 * How a new visit starts on a session Lab has reads on (its plan): the model's read, or every
 * Nth visit a blind check. Only with the model Lab named (the active one); otherwise, and with
 * no plan, the values are entered as usual.
 */
export function planVisit(s: VisitState, plan: SessionPlan | undefined, sinceBlind: number) {
  const reads = plan?.reads;
  if (!reads?.on || !reads.model || s.detected?.modelVersion !== reads.model) return s;
  return sinceBlind + 1 >= reads.every ? startBlind(s) : startRead(s);
}

/** The read, saved as it was: nothing changed (the outcome Lab works out on its own too). */
export const confirmedAsRead = (s: VisitState) => s.mode !== 'entered' && !!s.read && !s.edited;

// The label file (Lab's format, docs/plan/capture-lab.md › Outbox and upload)

export interface SessionInfo {
  id: string;
  startedAt: string;
  tags: string[];
  /** What Lab said to do for this session when it started (absent when Lab wasn't there). */
  plan?: SessionPlan;
}

/** Lab's plan for a session (lab/src/lib/reads.ts › sessionPlan). */
export interface SessionPlan {
  split: 'train' | 'val' | 'test';
  reads: { on: boolean; every: number; model: string | null; why: string };
}

export interface LabelFile {
  id: string;
  image: string;
  width: number;
  height: number;
  createdAt: string;
  sessionId: string;
  sessionStartedAt: string;
  tags: string[];
  calibration: (ImagePoint | null)[];
  darts: { x: number | null; y: number | null; value: string; onWire?: boolean }[];
  valuesOnly: boolean;
  /** Sent with "Label later": the photo only, to label in Lab (no points or darts). */
  unlabelled?: boolean;
  prefillModel: string | null;
  /** What the model placed (same order as calibration and darts), when it pre-filled. */
  prefill?: { calibration: (ImagePoint | null)[]; tips: (ImagePoint | null)[] };
  zoom?: number;
  labelMode?: LabelMode;
  /** The model's read (capture-lab.md › Model reads), in no throwing order. */
  read?: { model: string; darts: { value: string; sure: boolean; x: number; y: number }[] };
  blind?: { values: string[]; agreed: boolean; chose?: 'mine' | 'model' };
  /** Seconds from the photo to saving it. */
  seconds?: number;
}

const prefillModel = (s: VisitState) => (s.proposal ? (s.detected?.modelVersion ?? null) : null);

const round = (v: number) => Math.round(v * 1e5) / 1e5;
const pt = (p: ImagePoint) => ({ x: round(p.x), y: round(p.y) });

/**
 * The file Lab stores. "Values only" keeps the values (and the board, if marked) without tips:
 * Lab uses those for checking visit totals, not for training.
 */
export function labelFile(
  s: VisitState,
  meta: { id: string; createdAt: string; session: SessionInfo; zoom?: number; now?: number },
  valuesOnly = false,
): LabelFile {
  return {
    id: meta.id,
    image: `${meta.id}.jpg`,
    width: s.photo.width,
    height: s.photo.height,
    createdAt: meta.createdAt,
    sessionId: meta.session.id,
    sessionStartedAt: meta.session.startedAt,
    tags: meta.session.tags,
    calibration: CALIBRATION_IDS.map((id) => {
      const p = s.calibration[id];
      return p ? pt(p) : null;
    }),
    darts: s.entered.map((value, i) => {
      const tip = valuesOnly ? null : (s.tips[i] ?? null);
      return {
        x: tip ? round(tip.x) : null,
        y: tip ? round(tip.y) : null,
        value,
        ...(s.onWire[i] && tip ? { onWire: true } : {}),
      };
    }),
    valuesOnly,
    // The model proposed a board (even one the player then re-marked): its proposal goes along.
    prefillModel: prefillModel(s),
    ...(prefillModel(s) && s.proposal
      ? {
          prefill: {
            calibration: CALIBRATION_IDS.map((id) => {
              const p = s.proposal!.calibration[id];
              return p ? pt(p) : null;
            }),
            tips: s.entered.map((_, i) => {
              const p = s.proposal!.tips[i];
              return p ? pt(p) : null;
            }),
          },
        }
      : {}),
    ...(meta.zoom ? { zoom: meta.zoom } : {}),
    labelMode: s.mode,
    ...(s.read && s.mode !== 'entered' && !valuesOnly
      ? {
          read: {
            model: s.detected?.modelVersion ?? 'unknown',
            darts: s.read.map((r) => ({ value: r.value, sure: r.sure, ...pt(r.tip) })),
          },
        }
      : {}),
    ...(s.blind ? { blind: s.blind } : {}),
    seconds: Math.max(0, Math.round(((meta.now ?? Date.now()) - s.startedAt) / 1000)),
  };
}

/** The visit's total from what was entered. */
export const visitTotal = (entered: Entered[]) =>
  entered.reduce((sum, e) => {
    if (!needsTip(e)) return sum;
    if (e === 'Bull') return sum + 50;
    const m = /^([DT]?)(\d+)$/.exec(e);
    if (!m) return sum;
    return sum + Number(m[2]) * (m[1] === 'T' ? 3 : m[1] === 'D' ? 2 : 1);
  }, 0);
