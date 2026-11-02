import { hitOf, miss } from '../darts';

import { heatmap, parseRegion, regionOf } from './heatmap';

describe('heatmap', () => {
  it('counts darts per region with the busiest at full intensity', () => {
    const h = heatmap([hitOf(20, 3), hitOf(20, 3), hitOf(20, 1), hitOf(1, 1), miss()]);
    expect(h.total).toBe(5);
    expect(h.misses).toBe(1);
    expect(h.regions[0]).toEqual({ region: '20:treble', count: 2, intensity: 1 });
    expect(h.regions.find((r) => r.region === '1:outerSingle')?.intensity).toBe(0.5);
  });

  it('round-trips region keys', () => {
    expect(parseRegion(regionOf(hitOf(25, 2)))).toEqual({ segment: 25, ring: 'innerBull' });
    expect(parseRegion('miss')).toBeNull();
  });

  it('copes with no darts', () => {
    expect(heatmap([])).toEqual({ regions: [], misses: 0, total: 0 });
  });
});
