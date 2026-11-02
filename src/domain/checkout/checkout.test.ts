import { hitOfTarget, label } from '../darts';

import { BOGEY_NUMBERS, checkoutRoute, finishes, setupTarget, type OutRule } from '.';

const show = (r: number, n = 3, out: OutRule = 'double') =>
  checkoutRoute(r, n, out)?.map(label).join(' ') ?? null;

describe('checkout routes (double out)', () => {
  it('matches the standard big finishes', () => {
    expect(show(170)).toBe('T20 T20 Bull');
    expect(show(167)).toBe('T20 T19 Bull');
    expect(show(164)).toMatch(/^T(20 T18|19 T19) Bull$/);
    expect(show(161)).toBe('T20 T17 Bull');
    expect(show(160)).toBe('T20 T20 D20');
    expect(show(141)).toBe('T20 T19 D12');
    expect(show(100)).toBe('T20 D20');
    expect(show(140)).toBe('T20 T20 D10');
    expect(show(64)).toBe('T16 D8');
    expect(show(64, 1)).toBeNull();
  });

  it('takes one dart when one will do', () => {
    expect(show(40)).toBe('D20');
    expect(show(32)).toBe('D16');
    expect(show(50)).toBe('Bull');
    expect(show(2)).toBe('D1');
  });

  it('has no route for bogey numbers, 1, or above 170', () => {
    for (const r of [...BOGEY_NUMBERS, 1, 171, 180]) expect(show(r)).toBeNull();
    // ...and every other score from 2 to 170 has one.
    for (let r = 2; r <= 170; r++) {
      if ((BOGEY_NUMBERS as readonly number[]).includes(r)) continue;
      expect(show(r)).not.toBeNull();
    }
  });

  it('only routes that add up and finish on a double', () => {
    for (let n = 1; n <= 3; n++) {
      for (let r = 2; r <= 170; r++) {
        const route = checkoutRoute(r, n);
        if (!route) continue;
        expect(route.length).toBeLessThanOrEqual(n);
        expect(route.reduce((s, t) => s + hitOfTarget(t).score, 0)).toBe(r);
        expect(finishes(route[route.length - 1]!, 'double')).toBe(true);
      }
    }
  });

  it('respects the darts left', () => {
    expect(show(100, 1)).toBeNull();
    expect(show(120, 2)).toBeNull();
    expect(show(110, 2)).toBe('T20 Bull');
    expect(show(41, 1)).toBeNull();
  });

  it('leans toward a preferred double between equal routes', () => {
    expect(checkoutRoute(36, 2, 'double', 18)?.map(label).join(' ')).toBe('D18');
    // ...but not at the cost of a worse setup dart.
    expect(checkoutRoute(80, 2, 'double', 16)?.map(label)).toEqual(['T20', 'D10']);
  });
});

describe('other out rules', () => {
  it('master out finishes on trebles too, up to 180', () => {
    expect(show(180, 3, 'master')).toBe('T20 T20 T20');
    expect(show(3, 1, 'master')).toBe('T1');
    expect(show(1, 3, 'master')).toBeNull();
  });

  it('straight out finishes on anything', () => {
    expect(show(1, 1, 'straight')).toBe('1');
    expect(show(23, 1, 'straight')).toBeNull();
  });
});

describe('setupTarget', () => {
  it('aims at T20 while it cannot bust, then leaves a good double', () => {
    expect(label(setupTarget(301))).toBe('T20');
    expect(label(setupTarget(62))).toBe('T20');
    expect(label(setupTarget(59))).toBe('19');
    // 43 leaves 40 or 32.
    expect(['3', '11']).toContain(label(setupTarget(43)));
  });
});
