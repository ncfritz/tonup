import { hitOf, label } from '../darts';

import {
  SEGMENT_DEGREES,
  SEGMENT_ORDER,
  STEEL_TIP_RADII_MM as R,
  centreOf,
  hitAt,
  polar,
  segmentCentreDegrees,
} from '.';

describe('board geometry', () => {
  it('has each number 1–20 once', () => {
    expect([...SEGMENT_ORDER].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(SEGMENT_DEGREES).toBe(18);
  });

  it('puts the 20 at the top, the 6 at the right, the 3 at the bottom and the 11 at the left', () => {
    expect(segmentCentreDegrees(20)).toBe(0);
    expect(segmentCentreDegrees(6)).toBe(90);
    expect(segmentCentreDegrees(3)).toBe(180);
    expect(segmentCentreDegrees(11)).toBe(270);
    expect(() => segmentCentreDegrees(25)).toThrow(RangeError);
  });

  it('has rings in order from the bull out', () => {
    const order = [
      R.innerBull,
      R.outerBull,
      R.trebleInner,
      R.trebleOuter,
      R.doubleInner,
      R.doubleOuter,
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe('hitAt', () => {
  it('scores each ring along the 20', () => {
    expect(label(hitAt({ x: 0, y: 0 }))).toBe('Bull');
    expect(hitAt({ x: 0, y: 10 })).toMatchObject({ segment: 25, score: 25, ring: 'outerBull' });
    expect(hitAt({ x: 0, y: 50 })).toMatchObject({ segment: 20, score: 20, ring: 'innerSingle' });
    expect(hitAt({ x: 0, y: 103 })).toMatchObject({ segment: 20, score: 60, ring: 'treble' });
    expect(hitAt({ x: 0, y: 130 })).toMatchObject({ segment: 20, score: 20, ring: 'outerSingle' });
    expect(hitAt({ x: 0, y: 166 })).toMatchObject({ segment: 20, score: 40, isDouble: true });
    expect(hitAt({ x: 0, y: 171 })).toMatchObject({ segment: 0, score: 0, ring: 'miss' });
  });

  it('finds every segment around the board', () => {
    for (const s of SEGMENT_ORDER) {
      expect(hitAt(polar(103, segmentCentreDegrees(s))).score).toBe(s * 3);
    }
  });

  it('splits neighbouring segments at the wire between them', () => {
    // The 20 spans -9° to 9°; the 1 is to its right.
    expect(hitAt(polar(130, 8.9)).segment).toBe(20);
    expect(hitAt(polar(130, 9.1)).segment).toBe(1);
    expect(hitAt(polar(130, -8.9)).segment).toBe(20);
    expect(hitAt(polar(130, -9.1)).segment).toBe(5);
  });

  it('puts points on a wire in the inner region', () => {
    expect(hitAt({ x: 0, y: R.innerBull }).ring).toBe('innerBull');
    expect(hitAt({ x: 0, y: R.trebleOuter }).ring).toBe('treble');
    expect(hitAt({ x: 0, y: R.doubleOuter }).ring).toBe('double');
  });
});

describe('centreOf', () => {
  it('lands inside its own target', () => {
    for (const s of SEGMENT_ORDER) {
      for (const m of [1, 2, 3] as const) {
        const h = hitAt(centreOf({ segment: s, multiplier: m }));
        expect(h.score).toBe(hitOf(s, m).score);
        expect(h.multiplier).toBe(m);
      }
    }
    expect(hitAt(centreOf({ segment: 25, multiplier: 1 })).score).toBe(25);
    expect(hitAt(centreOf({ segment: 25, multiplier: 2 })).score).toBe(50);
  });
});

describe('hitOf and label', () => {
  it('builds keypad hits and labels them', () => {
    expect(label(hitOf(20, 3))).toBe('T20');
    expect(label(hitOf(16, 2))).toBe('D16');
    expect(label(hitOf(5, 1))).toBe('5');
    expect(label(hitOf(25, 1))).toBe('25');
    expect(hitOf(25, 2)).toMatchObject({ score: 50, isDouble: true });
    expect(() => hitOf(25, 3)).toThrow(RangeError);
    expect(() => hitOf(21, 1)).toThrow(RangeError);
  });
});

describe('drawPoint', () => {
  it('uses the landing point, or the centre of a keypad hit, and skips keypad misses', () => {
    const { drawPoint } = jest.requireActual<typeof import('.')>('.');
    expect(drawPoint({ point: { x: 1, y: 2 }, hit: hitOf(20, 3) })).toEqual({ x: 1, y: 2 });
    expect(drawPoint({ point: null, hit: hitOf(20, 3) })).toEqual(
      centreOf({ segment: 20, multiplier: 3 }),
    );
    expect(drawPoint({ point: null, hit: { segment: 0, multiplier: 0 } })).toBeNull();
  });
});
