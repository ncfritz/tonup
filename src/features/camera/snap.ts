// The snap-to-score flow as plain state (docs/plan/snap-to-score.md): read the photo, mark the
// board by hand when the model can't, then review, fix and confirm the darts.
import {
  CALIBRATION_IDS,
  captureLabels,
  fitBoard,
  LOW_CONFIDENCE,
  MAX_RESIDUAL_MM,
  pickDarts,
  propose,
  type BoardFit,
  type CalibrationId,
  type CaptureLabels,
  type DartProposal,
  type ImagePoint,
} from '@/domain/camera';
import type { DetectResult } from '@/services/vision';

export interface Photo {
  uri: string;
  width: number;
  height: number;
}

export type Phase =
  /** Tapping the calibration points, one by one. */
  { kind: 'mark'; step: number; failed?: boolean } | { kind: 'review' };

export interface SnapState {
  photo: Photo;
  detected: DetectResult | null;
  /** How the board was found. */
  board: 'model' | 'manual';
  phase: Phase;
  calibration: Partial<Record<CalibrationId, ImagePoint>>;
  fit: BoardFit | null;
  darts: { image: ImagePoint; confidence: number }[];
  /** Darts the player says missed the board. */
  missed: number;
  /** Darts this photo should score (what's left of the visit). */
  expected: number;
  selected: number | null;
}

const MIN_CONFIDENCE = 0.3;

/** Starts from what the model found: straight to review if it found the board, else marking. */
export function fromDetection(
  photo: Photo,
  detected: DetectResult | null,
  expected: number,
): SnapState {
  const base: SnapState = {
    photo,
    detected,
    board: 'manual',
    phase: { kind: 'mark', step: 0 },
    calibration: {},
    fit: null,
    darts: [],
    missed: 0,
    expected,
    selected: null,
  };
  if (!detected) return base;
  const calibration: Partial<Record<CalibrationId, ImagePoint>> = {};
  for (const id of CALIBRATION_IDS) {
    const k = detected.keypoints[id];
    if (k && k.c >= MIN_CONFIDENCE) calibration[id] = { x: k.x, y: k.y };
  }
  const fit = fitBoard(calibration);
  if (!fit || fit.residual > MAX_RESIDUAL_MM) return base;
  const tips = detected.tips
    .filter((t) => t.c >= MIN_CONFIDENCE)
    .map((t) => ({ x: t.x, y: t.y, confidence: t.c }));
  const darts = pickDarts(fit, tips, expected).map((d) => ({
    image: d.image,
    confidence: d.confidence,
  }));
  return { ...base, board: 'model', phase: { kind: 'review' }, calibration, fit, darts };
}

/** The calibration point a marking step asks for. */
export const markStep = (s: SnapState): CalibrationId | null =>
  s.phase.kind === 'mark' ? (CALIBRATION_IDS[s.phase.step] ?? null) : null;

/** A tap on the photo. */
export function tap(s: SnapState, p: ImagePoint): SnapState {
  if (s.phase.kind === 'mark') {
    const id = CALIBRATION_IDS[s.phase.step]!;
    const calibration = { ...s.calibration, [id]: p };
    const step = s.phase.step + 1;
    if (step < CALIBRATION_IDS.length) return { ...s, calibration, phase: { kind: 'mark', step } };
    const fit = fitBoard(calibration);
    if (!fit || fit.residual > MAX_RESIDUAL_MM) {
      // Points that don't make a board (out of order, say): start the marking again.
      return { ...s, calibration: {}, fit: null, phase: { kind: 'mark', step: 0, failed: true } };
    }
    return { ...s, calibration, fit, phase: { kind: 'review' }, board: 'manual' };
  }
  if (s.selected !== null) {
    const darts = s.darts.map((d, i) => (i === s.selected ? { image: p, confidence: 1 } : d));
    return { ...s, darts, selected: null };
  }
  if (s.darts.length + s.missed < s.expected) {
    return { ...s, darts: [...s.darts, { image: p, confidence: 1 }] };
  }
  return s;
}

export const select = (s: SnapState, i: number | null): SnapState => ({
  ...s,
  selected: s.selected === i ? null : i,
});

export const remove = (s: SnapState, i: number): SnapState => ({
  ...s,
  darts: s.darts.filter((_, j) => j !== i),
  selected: null,
});

export const addMiss = (s: SnapState): SnapState =>
  s.darts.length + s.missed < s.expected ? { ...s, missed: s.missed + 1 } : s;

export const undoMiss = (s: SnapState): SnapState => ({ ...s, missed: Math.max(0, s.missed - 1) });

/** Marks the board again by hand (the model's board looked wrong). */
export const remark = (s: SnapState): SnapState => ({
  ...s,
  board: 'manual',
  calibration: {},
  fit: null,
  phase: { kind: 'mark', step: 0 },
  selected: null,
});

export function proposals(s: SnapState): DartProposal[] {
  const fit = s.fit;
  if (!fit) return [];
  return s.darts.map((d) => propose(fit, d.image, d.confidence));
}

/** Needs a look before confirming: a low-confidence dart or one on a wire. */
export const needsLook = (d: DartProposal) => d.confidence < LOW_CONFIDENCE || d.nearWire;

/** All the visit's darts are accounted for (found or missed). */
export const complete = (s: SnapState) =>
  s.phase.kind === 'review' && s.darts.length + s.missed === s.expected;

export const labelsOf = (s: SnapState): CaptureLabels =>
  captureLabels(
    s.calibration,
    s.darts.map((d) => d.image),
    s.missed,
  );
