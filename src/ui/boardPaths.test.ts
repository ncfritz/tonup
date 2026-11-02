import { ringWedges, wedgePath } from './boardPaths';

describe('board paths', () => {
  it('draws a closed wedge between two radii', () => {
    // The top-right quarter of a ring from radius 10 to 20 around (0, 0).
    expect(wedgePath(0, 0, 10, 20, 0, 90)).toBe(
      'M0 -20 A20 20 0 0 1 20 0 L10 0 A10 10 0 0 0 0 -10 Z',
    );
  });

  it('makes one wedge per segment, alternating, with the 20 first and dark', () => {
    const wedges = ringWedges(200, 200, 95, 111);
    expect(wedges).toHaveLength(20);
    expect(wedges[0]).toMatchObject({ segment: 20, alt: true });
    expect(wedges[1]).toMatchObject({ segment: 1, alt: false });
  });
});
