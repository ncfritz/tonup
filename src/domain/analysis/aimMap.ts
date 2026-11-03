// The personal aim map (docs/research/training.md; Tibshirani, Price and Taylor, "A Statistician
// Plays Darts"): fit your scatter as a circular Gaussian, then find where on the board to aim for
// the most points per dart. A tight grouping should aim at T20; a wide one does better nearer
// the middle, toward the 19 and 16 side.
import { centreOf, hitAt } from '../board';
import { BULL, type BoardType, type Point } from '../darts';

import type { Offset } from './grouping';

/** Fewest offsets the map is drawn from. */
export const AIM_MAP_MIN = 30;

/** The circular-Gaussian scatter that best fits the offsets around the aim (the MLE). */
export function fitSigma(offsets: readonly Offset[]): number {
  if (offsets.length === 0) return NaN;
  const ss = offsets.reduce((s, o) => s + o.dx * o.dx + o.dy * o.dy, 0);
  return Math.sqrt(ss / (2 * offsets.length));
}

function halton(i: number, base: number): number {
  let f = 1;
  let r = 0;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

/**
 * Sample points of a standard 2D normal: a Halton sequence through Box–Muller. Low-discrepancy
 * points average the board's sharp edges better than a regular grid at the same cost.
 */
const SAMPLES = Array.from({ length: 512 }, (_, k) => {
  const u = Math.max(halton(k + 1, 2), 1e-9);
  const v = halton(k + 1, 3);
  const r = Math.sqrt(-2 * Math.log(u));
  return { u: r * Math.cos(2 * Math.PI * v), v: r * Math.sin(2 * Math.PI * v) };
});

/** Expected points per dart aiming at `aim` with circular scatter `sigma`. */
export function expectedScore(aim: Point, sigma: number, board: BoardType = 'steel'): number {
  if (sigma <= 0.01) return hitAt(aim, board).score;
  let e = 0;
  for (const q of SAMPLES)
    e += hitAt({ x: aim.x + q.u * sigma, y: aim.y + q.v * sigma }, board).score;
  return e / SAMPLES.length;
}

export interface AimMap {
  sigma: number;
  /** The best aim found and its expected points per dart. */
  best: { point: Point; score: number };
  /** For comparison: aiming at T20 and at the bullseye. */
  t20: number;
  bull: number;
  /** Expected points on a grid of aim points over the board, for the overlay. */
  cells: { point: Point; score: number }[];
  step: number;
}

/** The aim map for a scatter: a coarse grid and every bed's centre, then a closer look at the best three. */
export function aimMap(sigma: number, step = 14, board: BoardType = 'steel'): AimMap {
  const R = 170;
  const cells: { point: Point; score: number }[] = [];
  for (let x = -R; x <= R; x += step) {
    for (let y = -R; y <= R; y += step) {
      if (Math.hypot(x, y) > R) continue;
      cells.push({ point: { x, y }, score: expectedScore({ x, y }, sigma, board) });
    }
  }
  const beds: Point[] = [centreOf({ segment: BULL, multiplier: 2 }, board)];
  for (let n = 1; n <= 20; n++) {
    beds.push(
      centreOf({ segment: n, multiplier: 3 }, board),
      centreOf({ segment: n, multiplier: 2 }, board),
    );
  }
  const candidates = [
    ...cells,
    ...beds.map((point) => ({ point, score: expectedScore(point, sigma, board) })),
  ].sort((a, b) => b.score - a.score);
  let best = candidates[0]!;
  const fine = step / 4;
  for (const c of candidates.slice(0, 3)) {
    for (let i = -4; i <= 4; i++) {
      for (let j = -4; j <= 4; j++) {
        const point = { x: c.point.x + i * fine, y: c.point.y + j * fine };
        const score = expectedScore(point, sigma, board);
        if (score > best.score) best = { point, score };
      }
    }
  }
  return {
    sigma,
    best,
    t20: expectedScore(centreOf({ segment: 20, multiplier: 3 }, board), sigma, board),
    bull: expectedScore(centreOf({ segment: BULL, multiplier: 2 }, board), sigma, board),
    cells,
    step,
  };
}
