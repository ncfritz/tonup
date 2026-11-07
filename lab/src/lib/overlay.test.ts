import { describe, expect, it } from 'vitest';

import { bedPath } from './overlay';
import { defaultPoints } from './guess';

// A board square on in a 400 × 400 photo: 1 mm is 120/170 px, the bull at (200, 200).
const points = defaultPoints(400, 400);
const coords = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));

describe('bedPath', () => {
  it('draws a treble 20 above the bull, inside the treble ring', () => {
    const pts = coords(bedPath('T20', points, 400, 400)!);
    const mmPerPx = 170 / 120;
    for (const p of pts) {
      const r = Math.hypot(p.x - 200, p.y - 200) * mmPerPx;
      expect(r).toBeGreaterThan(98);
      expect(r).toBeLessThan(108);
      expect(p.y).toBeLessThan(200);
    }
  });
  it('draws both single beds for a single, and nothing for a miss or an unfitted board', () => {
    expect(bedPath('20', points, 400, 400)!.match(/M/g)).toHaveLength(2);
    expect(bedPath('25', points, 400, 400)!.match(/M/g)).toHaveLength(2);
    expect(bedPath('Bull', points, 400, 400)!.match(/M/g)).toHaveLength(1);
    expect(bedPath('Miss', points, 400, 400)).toBeNull();
    expect(bedPath(null, points, 400, 400)).toBeNull();
    expect(bedPath('T20', { bull: points.bull }, 400, 400)).toBeNull();
  });
});
