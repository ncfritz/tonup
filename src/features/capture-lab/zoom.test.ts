import { squareOf } from './square';
import { clampZoom, MAX_ZOOM, zoomAbout } from './ZoomPan';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));

const size = { w: 400, h: 400 };

describe('zooming the photo', () => {
  it('keeps the point under the fingers where it is', () => {
    const z = zoomAbout({ s: 1, x: 0, y: 0 }, 2, { x: 300, y: 100 }, size);
    // Content point (300, 100) maps to centre + t + s·(p − centre).
    expect(200 + z.x + 2 * (300 - 200)).toBeCloseTo(300);
    expect(200 + z.y + 2 * (100 - 200)).toBeCloseTo(100);
  });

  it('moves the photo with the fingers while pinching', () => {
    const z = zoomAbout({ s: 2, x: 0, y: 0 }, 2, { x: 200, y: 200 }, size, { x: 230, y: 180 });
    expect(z).toEqual({ s: 2, x: 30, y: -20 });
  });

  it('stays between the whole photo and the most zoom, and never shows past its edge', () => {
    expect(zoomAbout({ s: 1, x: 0, y: 0 }, 0.5, { x: 50, y: 50 }, size)).toEqual({
      s: 1,
      x: 0,
      y: 0,
    });
    expect(zoomAbout({ s: 1, x: 0, y: 0 }, 99, { x: 200, y: 200 }, size).s).toBe(MAX_ZOOM);
    expect(clampZoom({ s: 2, x: 500, y: -500 }, size)).toEqual({ s: 2, x: 200, y: -200 });
  });
});

describe('the square photo', () => {
  it('is the centred square of the shot', () => {
    expect(squareOf(3024, 4032)).toEqual({ originX: 0, originY: 504, width: 3024, height: 3024 });
    expect(squareOf(4032, 3024)).toEqual({ originX: 504, originY: 0, width: 3024, height: 3024 });
    expect(squareOf(1000, 1000)).toEqual({ originX: 0, originY: 0, width: 1000, height: 1000 });
  });
});
