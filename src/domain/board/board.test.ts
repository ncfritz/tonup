import { SEGMENT_DEGREES, SEGMENT_ORDER, STEEL_TIP_RADII_MM, segmentCentreDegrees } from '.';

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
    const r = STEEL_TIP_RADII_MM;
    const order = [
      r.innerBull,
      r.outerBull,
      r.trebleInner,
      r.trebleOuter,
      r.doubleInner,
      r.doubleOuter,
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
