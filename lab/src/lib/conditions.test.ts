import { boardPointOf, CALIBRATION_IDS, type CalibrationId } from '@domain/camera';
import { polar } from '@domain/board';
import { describe, expect, it } from 'vitest';

import { measure, needsLabelling, normaliseValue } from './conditions';
import type { LabelInput } from './labels';

/**
 * A board seen at `angleDeg` off face-on (squashed sideways), centred in a 1000×1000 photo with
 * the board 600 px across; returns where a board point (mm) lands, normalised.
 */
function camera(angleDeg: number) {
  const squash = Math.cos((angleDeg * Math.PI) / 180);
  return (p: { x: number; y: number }) => ({
    x: 0.5 + (p.x / 170) * 0.3 * squash,
    y: 0.5 - (p.y / 170) * 0.3,
  });
}

function labelFor(angleDeg: number, tipsMm: { x: number; y: number }[], entered: string[]) {
  const toImage = camera(angleDeg);
  const points: Partial<Record<CalibrationId, { x: number; y: number }>> = {};
  for (const id of CALIBRATION_IDS) points[id] = toImage(boardPointOf(id));
  const input: LabelInput = {
    points,
    darts: tipsMm.map((t, i) => ({ entered: entered[i] ?? null, tip: toImage(t), onWire: false })),
    missed: 0,
  };
  return input;
}

describe('normaliseValue', () => {
  it('maps keypad and shorthand values to the scorer’s labels', () => {
    expect(normaliseValue('S5')).toBe('5');
    expect(normaliseValue('t20')).toBe('T20');
    expect(normaliseValue('D05')).toBe('D5');
    expect(normaliseValue('50')).toBe('Bull');
    expect(normaliseValue('SB')).toBe('25');
    expect(normaliseValue('bounce out')).toBe('Bounce-out');
    expect(normaliseValue('miss')).toBe('Miss');
  });
});

describe('measure', () => {
  it('scores tips through the board fit and finds no problems when values match', () => {
    const m = measure(labelFor(0, [polar(103, 0), polar(130, -18)], ['T20', '5']), 1000, 1000);
    expect(m.darts.map((d) => d.scored)).toEqual(['T20', '5']);
    expect(m.review).toEqual([]);
    expect(m.dartCount).toBe(2);
    expect(m.fitResidualMm).toBeLessThan(0.01);
  });

  it('measures the board size and the camera angle from the board outline', () => {
    const face = measure(labelFor(0, [], []), 1000, 1000);
    expect(face.boardPx).toBeCloseTo(600, 0);
    expect(face.angleDeg).toBeLessThan(1);
    const side = measure(labelFor(40, [], []), 1000, 1000);
    expect(side.angleDeg).toBeCloseTo(40, 0);
  });

  it('flags a value that disagrees with its tip, and a dart on the wire', () => {
    const input = labelFor(20, [polar(103, 0), polar(130, -18)], ['T20', '20']);
    input.darts[1]!.onWire = true;
    const m = measure(input, 1000, 1000);
    expect(m.darts[1]!.mismatch).toBe(true);
    expect(m.review).toEqual(['value mismatch', 'on the wire']);
  });

  it('treats Miss and Bounce-out as having no tip to check', () => {
    const input = labelFor(0, [polar(103, 0)], ['T20']);
    input.darts.push({ entered: 'Bounce-out', tip: null, onWire: false });
    const m = measure(input, 1000, 1000);
    expect(m.review).toEqual([]);
    expect(m.darts[1]!.scored).toBeNull();
  });

  it('spots a tight group', () => {
    expect(measure(labelFor(0, [polar(103, 0), polar(103, 3)], []), 1000, 1000).tightGroup).toBe(
      true,
    );
    expect(measure(labelFor(0, [polar(103, 0), polar(103, 40)], []), 1000, 1000).tightGroup).toBe(
      false,
    );
  });

  it('asks for the board when tips have no fit', () => {
    const input = labelFor(0, [polar(103, 0)], ['T20']);
    input.points = { cal20: input.points.cal20! };
    expect(measure(input, 1000, 1000).review).toEqual(['board not marked']);
  });
});

describe('needsLabelling', () => {
  const kinds = ['a', 'b'];
  const all = [{ kind: 'a' }, { kind: 'b' }];
  it('wants every board point placed', () => {
    expect(needsLabelling([{ kind: 'a' }], [], kinds)).toBe(true);
    expect(needsLabelling(all, [], kinds)).toBe(false);
  });
  it('wants a tip for every dart on the board, not for a miss or bounce-out', () => {
    expect(needsLabelling(all, [{ entered: 'T20', hasTip: false }], kinds)).toBe(true);
    expect(needsLabelling(all, [{ entered: null, hasTip: false }], kinds)).toBe(true);
    expect(needsLabelling(all, [{ entered: 'T20', hasTip: true }], kinds)).toBe(false);
    expect(needsLabelling(all, [{ entered: 'miss', hasTip: false }], kinds)).toBe(false);
    expect(needsLabelling(all, [{ entered: 'BO', hasTip: false }], kinds)).toBe(false);
  });
});
