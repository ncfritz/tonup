// Labelling one visit in Ton Up Capture (docs/plan/capture-lab.md › Ton Up Capture): enter
// what the darts scored, mark the board, tap each tip. Every tip is scored through the board
// fit and must match its value, or be flagged as on the wire, before the visit can be saved.
import {
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

export type Step = 'values' | 'board' | 'tips' | 'review';

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
}

const MIN_CONFIDENCE = 0.3;

/** Starts on a new photo; the model's board, if it found one, is kept for the board step. */
export function start(photo: Photo, detected: DetectResult | null): VisitState {
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
  if (s.step !== 'tips') return s;
  const target = s.selected ?? firstMissing(s);
  if (target === null) return s;
  const tips = s.tips.map((t, i) => (i === target ? p : t));
  const next = { ...s, tips };
  return { ...next, selected: firstMissing(next) };
}

export const selectDart = (s: VisitState, i: number | null): VisitState => ({
  ...s,
  selected: i !== null && needsTip(s.entered[i] ?? MISS) ? (s.selected === i ? null : i) : null,
});

export const toggleWire = (s: VisitState, i: number): VisitState => ({
  ...s,
  onWire: s.onWire.map((w, k) => (k === i ? !w : w)),
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
  if (s.step === 'review') return { ...s, step: 'tips' };
  if (s.step === 'tips') return { ...s, step: 'board', selected: null };
  if (s.step === 'board') return { ...s, step: 'values' };
  return s;
}

// The label file (Lab's format, docs/plan/capture-lab.md › Outbox and upload)

export interface SessionInfo {
  id: string;
  startedAt: string;
  tags: string[];
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
  meta: { id: string; createdAt: string; session: SessionInfo; zoom?: number },
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
