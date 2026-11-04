import { describe, expect, it } from 'vitest';

import { splitOf } from './splits';

describe('splitOf', () => {
  it('matches ml/tonup_ml/data.py split_of for the same groups', () => {
    // Values computed with the Python function.
    expect(splitOf('2026-11-03')).toBe('val');
    expect(splitOf('session-a')).toBe('train');
    expect(splitOf('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe('train');
    expect(splitOf('x')).toBe('test');
  });

  it('comes out near 80/10/10 over many sessions', () => {
    const counts = { train: 0, val: 0, test: 0 };
    for (let i = 0; i < 10_000; i++) counts[splitOf(`session-${i}`)]++;
    expect(counts.train / 10_000).toBeCloseTo(0.8, 1);
    expect(counts.val / 10_000).toBeCloseTo(0.1, 1);
    expect(counts.test / 10_000).toBeCloseTo(0.1, 1);
  });
});
