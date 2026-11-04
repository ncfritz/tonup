// What Lab measures from a label (capture-lab.md › Data): the board fit, each tip's score, the
// camera angle and board size from the board's outline, tight groups, and why a label needs a
// look. Uses the same geometry as the phone (src/domain/camera).
import { label } from '@domain/darts';
import { applyHomography, fitBoard, MAX_RESIDUAL_MM, propose, type BoardFit } from '@domain/camera';
import { polar } from '@domain/board';

import type { LabelInput } from './labels';

/** Two tips closer than this (mm on the board) count as a tight group. */
export const TIGHT_GROUP_MM = 15;

/** Normalises an entered value to the scorer's labels ("S5" → "5", "50" → "Bull"). */
export function normaliseValue(v: string): string {
  const s = v.trim().toUpperCase().replace(/\s+/g, '');
  if (s === 'BULL' || s === '50' || s === 'DB' || s === 'D25') return 'Bull';
  if (s === '25' || s === 'SB' || s === 'OB') return '25';
  if (s === 'MISS' || s === 'M' || s === '0') return 'Miss';
  if (s === 'BOUNCE-OUT' || s === 'BOUNCEOUT' || s === 'BO') return 'Bounce-out';
  const single = /^S?(\d{1,2})$/.exec(s);
  if (single) return String(Number(single[1]));
  const mult = /^([DT])(\d{1,2})$/.exec(s);
  if (mult) return `${mult[1]}${Number(mult[2])}`;
  return v.trim();
}

export interface ScoredDart {
  entered: string | null;
  scored: string | null;
  onWire: boolean;
  /** Within NEAR_WIRE_MM of a wire through the fit. */
  nearWire: boolean;
  /** Entered and scored disagree. */
  mismatch: boolean;
  /** Board position in mm, when there is a tip and a fit. */
  board: { x: number; y: number } | null;
}

export interface Measured {
  fit: BoardFit | null;
  darts: ScoredDart[];
  angleDeg: number | null;
  boardPx: number | null;
  dartCount: number;
  tightGroup: boolean;
  fitResidualMm: number | null;
  /** Why it needs a look, or empty. */
  review: string[];
}

/**
 * The board's outline (the outside of the double ring) projected into the photo, in pixels:
 * its long axis is the board's size across, and the ratio of the axes the camera's angle off
 * face-on (a circle seen at angle θ is an ellipse with axes in the ratio cos θ).
 */
export function outline(fit: BoardFit, width: number, height: number) {
  const pts = Array.from({ length: 72 }, (_, i) => {
    const p = applyHomography(fit.toImage, polar(170, i * 5));
    return { x: p.x * width, y: p.y * height };
  });
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  sxx /= pts.length;
  syy /= pts.length;
  sxy /= pts.length;
  // Eigenvalues of the covariance; for points spread evenly round an ellipse, λ = axis² / 2.
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const major = 2 * Math.sqrt(2 * (tr / 2 + disc));
  const minor = 2 * Math.sqrt(2 * Math.max(0, tr / 2 - disc));
  return {
    boardPx: major,
    angleDeg: (Math.acos(Math.min(1, minor / major)) * 180) / Math.PI,
  };
}

export function measure(input: LabelInput, width: number, height: number): Measured {
  const fit = fitBoard(input.points);
  const darts: ScoredDart[] = input.darts.map((d) => {
    const proposal = fit && d.tip ? propose(fit, d.tip) : null;
    const scored = proposal ? label(proposal.hit) : null;
    const entered = d.entered ? normaliseValue(d.entered) : null;
    const tipless = entered === 'Miss' || entered === 'Bounce-out';
    return {
      entered,
      scored,
      onWire: d.onWire,
      nearWire: proposal?.nearWire ?? false,
      mismatch: entered !== null && scored !== null && !tipless && entered !== scored,
      board: proposal ? proposal.point : null,
    };
  });
  const onBoard = darts.filter((d) => d.board);
  let tightGroup = false;
  for (let i = 0; i < onBoard.length; i++) {
    for (let j = i + 1; j < onBoard.length; j++) {
      const a = onBoard[i]!.board!;
      const b = onBoard[j]!.board!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < TIGHT_GROUP_MM) tightGroup = true;
    }
  }
  const shape = fit ? outline(fit, width, height) : null;
  const tips = input.darts.filter((d) => d.tip).length;
  const review: string[] = [];
  if (!fit) {
    if (tips > 0) review.push('board not marked');
  } else if (fit.residual > MAX_RESIDUAL_MM) review.push('board marks disagree');
  if (darts.some((d) => d.mismatch)) review.push('value mismatch');
  if (darts.some((d) => d.onWire)) review.push('on the wire');
  return {
    fit,
    darts,
    angleDeg: shape?.angleDeg ?? null,
    boardPx: shape?.boardPx ?? null,
    dartCount: tips,
    tightGroup,
    fitResidualMm: fit?.residual ?? null,
    review,
  };
}
