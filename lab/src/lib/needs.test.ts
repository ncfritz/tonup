import { describe, expect, it } from 'vitest';

import type { Measured, ScoredDart } from './conditions';
import type { LabelInput } from './labels';
import { needsOf } from './needs';

const dart = (d: Partial<ScoredDart>): ScoredDart => ({
  entered: null,
  scored: null,
  onWire: false,
  nearWire: false,
  mismatch: false,
  board: null,
  ...d,
});

const measured = (m: Partial<Measured>): Measured => ({
  fit: null,
  darts: [],
  angleDeg: null,
  boardPx: null,
  dartCount: 0,
  tightGroup: false,
  fitResidualMm: null,
  review: [],
  ...m,
});

const label = (points: LabelInput['points']): LabelInput =>
  ({ points, darts: [], missed: 0 }) as LabelInput;
const P = { x: 0.5, y: 0.5 };

describe('needsOf', () => {
  it('pins each reason to the dart or board point it is about', () => {
    const n = needsOf(
      label({ cal20: P, cal6: P, cal3: P, cal11: P, bull: P }),
      measured({
        fit: {
          toBoard: [],
          toImage: [],
          residual: 12,
          errors: { cal20: 3, cal6: 2, cal3: 4, cal11: 3, bull: 12 },
          used: ['cal20', 'cal6', 'cal3', 'cal11', 'bull'],
        },
        darts: [
          dart({ entered: 'T20', scored: 'T20' }),
          dart({ entered: '3', scored: '19', mismatch: true }),
          dart({ entered: 'D5', scored: 'D5', onWire: true }),
        ],
        review: ['board marks disagree', 'value mismatch', 'on the wire'],
      }),
      false,
    );
    expect(n.points).toEqual({ bull: 'error' });
    expect(n.darts).toEqual({ 1: 'error', 2: 'warning' });
    expect(n.list.map((x) => x.text)).toEqual([
      "Board points don't agree: Bull is 12 mm out, the most of any. Check it first",
      'Dart 2: entered 3, its tip scores 19. Fix whichever is wrong',
      'Dart 3 is on the wire: check D5 is the side it counted',
    ]);
    expect(n.list[0]!.target).toEqual({ kind: 'point', id: 'bull' });
  });

  it('asks for the board points still missing, and flags a corrected label', () => {
    const n = needsOf(
      label({ cal20: P, cal6: P }),
      measured({ review: ['board not marked'] }),
      true,
    );
    expect(n.points).toEqual({ cal3: 'warning', cal11: 'warning', bull: 'warning' });
    expect(n.list[0]!.text).toBe(
      'Board points: place 2 more so the tips can be scored (17/3, 8/11, Bull not placed)',
    );
    expect(n.list.at(-1)!.key).toBe('corrected');
  });

  it('asks for a photo sent to label here to be labelled', () => {
    const n = needsOf(label({}), measured({}), false, true);
    expect(n.list.map((x) => x.key)).toEqual(['unlabelled']);
    expect(n.list[0]!.target).toEqual({ kind: 'point', id: 'cal20' });
  });

  it('is empty when nothing needs a look', () => {
    expect(needsOf(label({}), measured({}), false).list).toEqual([]);
  });
});
