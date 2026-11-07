// How much of a model's pre-fill the player kept (capture-lab.md › Capture flow: "the model only
// proposes; the player always confirms"). Capture sends what the model placed beside the label
// the player confirmed; Lab measures the moves on the board, in mm, through the confirmed fit.
// A visit is accepted when the board and every tip the model placed stayed put and the model
// placed every tip the visit needed: the L5 measure that labelling has become confirming.
import { applyHomography, CALIBRATION_IDS, fitBoard, type ImagePoint } from '@domain/camera';

import type { LabelInput } from './labels';

/** Review reason for a label the player corrected from the model's pre-fill. */
export const CORRECTED = 'corrected from model';
/** Review reasons from model reads (lib/reads.ts): a read the player fixed, a blind check that disagreed. */
export const READ_FIXED = 'read fixed';
export const BLIND_DISAGREED = 'blind check disagreed';
/** The reasons that lead the To review queue and that Looks right clears: the model went wrong. */
export const MODEL_WRONG = [CORRECTED, READ_FIXED, BLIND_DISAGREED];

/** The review reason a photo sent to label in Lab carries until it's labelled. */
export const NOT_LABELLED = 'not labelled';

/** A point moved further than this (mm on the board) was corrected, not accepted. */
export const MOVED_MM = 3;

export interface Proposal {
  /** DeepDarts order (cal20, cal6, cal3, cal11, bull), null where the model found none. */
  calibration: (ImagePoint | null)[];
  /** One per dart in the visit, null where the model placed no tip. */
  tips: (ImagePoint | null)[];
}

export interface PrefillCheck {
  /** The model's board was kept (no point moved more than MOVED_MM). */
  boardKept: boolean;
  /** The furthest a calibration point moved, in mm; null when the board can't be compared. */
  boardMovedMm: number | null;
  /** Tips the confirmed label has. */
  tipsNeeded: number;
  /** Tips the model placed. */
  tipsPlaced: number;
  /** Of those, kept where the model put them. */
  tipsKept: number;
  accepted: boolean;
}

export function checkPrefill(proposal: Proposal, confirmed: LabelInput): PrefillCheck {
  const proposed: Partial<Record<(typeof CALIBRATION_IDS)[number], ImagePoint>> = {};
  CALIBRATION_IDS.forEach((id, i) => {
    const p = proposal.calibration[i];
    if (p) proposed[id] = p;
  });
  // Distances on the board through the player's board, or the model's when the player kept none.
  const fit = fitBoard(confirmed.points) ?? fitBoard(proposed);
  const mm = (a: ImagePoint, b: ImagePoint) => {
    if (!fit) return Infinity;
    const p = applyHomography(fit.toBoard, a);
    const q = applyHomography(fit.toBoard, b);
    return Math.hypot(p.x - q.x, p.y - q.y);
  };

  let boardMovedMm: number | null = null;
  let compared = 0;
  for (const id of CALIBRATION_IDS) {
    const a = proposed[id];
    const b = confirmed.points[id];
    if (!a && !b) continue;
    // A point the model found and the player dropped, or added, is a change.
    const d = a && b ? mm(a, b) : Infinity;
    boardMovedMm = Math.max(boardMovedMm ?? 0, d);
    compared++;
  }
  if (!fit || !compared) boardMovedMm = null;
  const boardKept = boardMovedMm !== null && boardMovedMm <= MOVED_MM;

  let tipsNeeded = 0;
  let tipsPlaced = 0;
  let tipsKept = 0;
  confirmed.darts.forEach((d, i) => {
    const placed = proposal.tips[i] ?? null;
    if (d.tip) tipsNeeded++;
    if (placed) tipsPlaced++;
    if (placed && d.tip && mm(placed, d.tip) <= MOVED_MM) tipsKept++;
  });

  return {
    boardKept,
    // Infinite when a point was dropped or added: kept as "not comparable" rather than a distance.
    boardMovedMm: boardMovedMm !== null && Number.isFinite(boardMovedMm) ? boardMovedMm : null,
    tipsNeeded,
    tipsPlaced,
    tipsKept,
    accepted: boardKept && tipsKept === tipsNeeded && tipsPlaced === tipsNeeded,
  };
}
