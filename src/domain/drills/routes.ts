// The checkout trainer (docs/research/training.md → Experiences): decks of finishes, and a short
// "why this route" for each, built from the same checkout table the scoreboard uses.
import type { Rng } from '../bot/rng';
import { checkoutRoute, type Route } from '../checkout';
import { BULL, hitOfTarget, label, type Target } from '../darts';

import { draw, finishable } from './checkouts';

export type RouteNote =
  /** A one-dart finish. */
  | { kind: 'one'; double: string }
  /** The first dart and what it leaves. */
  | {
      kind: 'leaves';
      dart: string;
      left: number;
      finish: 'double' | 'bull' | 'darts';
      darts: number;
    }
  /** A treble missed into its single, and whether that still finishes. */
  | { kind: 'single'; single: string; left: number; ok: boolean }
  /** The finishing double missed into its single leaves the half-double. */
  | { kind: 'split'; double: string; single: string; next: string }
  | { kind: 'bull' };

export type TrainerRange = 'low' | 'mid' | 'high';
export const TRAINER_RANGES: Record<TrainerRange, [number, number]> = {
  low: [2, 40],
  mid: [41, 100],
  high: [101, 170],
};
export const DECK_SIZE = 10;

/** A deck of finishes in a range, each at most once. */
export const trainerDeck = (range: TrainerRange, rng: Rng, size = DECK_SIZE) =>
  draw(finishable(...TRAINER_RANGES[range]), size, rng);

/** The route the trainer teaches: the table's three-dart route. */
export const trainerRoute = (score: number): Route | null => checkoutRoute(score, 3);

const value = (t: Target) => hitOfTarget(t).score;

export function explainRoute(score: number, route: Route): RouteNote[] {
  const notes: RouteNote[] = [];
  const last = route[route.length - 1]!;
  if (route.length === 1) {
    notes.push(last.segment === BULL ? { kind: 'bull' } : { kind: 'one', double: label(last) });
  } else {
    const first = route[0]!;
    const left = score - value(first);
    const rest = route.length - 1;
    const finish = rest === 1 ? (route[1]!.segment === BULL ? 'bull' : 'double') : 'darts';
    notes.push({ kind: 'leaves', dart: label(first), left, finish, darts: rest });
    if (first.multiplier === 3) {
      const singleLeft = score - first.segment;
      notes.push({
        kind: 'single',
        single: label({ segment: first.segment, multiplier: 1 }),
        left: singleLeft,
        ok: checkoutRoute(singleLeft, rest) !== null,
      });
    }
  }
  if (last.multiplier === 2 && last.segment !== BULL && last.segment % 2 === 0) {
    notes.push({
      kind: 'split',
      double: label(last),
      single: String(last.segment),
      next: label({ segment: last.segment / 2, multiplier: 2 }),
    });
  }
  return notes;
}
