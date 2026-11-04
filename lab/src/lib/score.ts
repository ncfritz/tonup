// Scoring shared with the phone (ADR 0012): the same domain code Ton Up and Capture use.
import { hitAt, polar } from '@domain/board';
import { label } from '@domain/darts';

/** The label for a point on the board face, `radius` mm out at `deg` clockwise from the 20. */
export function labelAt(radius: number, deg: number): string {
  return label(hitAt(polar(radius, deg)));
}

/** A known dart for the Overview's self-check: the middle of the treble 20. */
export const SELF_CHECK = { radius: 103, deg: 0, expected: 'T20' } as const;
