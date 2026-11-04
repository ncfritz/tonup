import { describe, expect, it } from 'vitest';

import { labelAt, SELF_CHECK } from './score';

describe('scoring through the shared domain code', () => {
  it('scores the self-check dart', () => {
    expect(labelAt(SELF_CHECK.radius, SELF_CHECK.deg)).toBe(SELF_CHECK.expected);
  });

  it('scores rings and segments around the board', () => {
    expect(labelAt(0, 0)).toBe('Bull');
    expect(labelAt(10, 90)).toBe('25');
    expect(labelAt(166, 90)).toBe('D6');
    expect(labelAt(130, 180)).toBe('3');
    expect(labelAt(103, 270)).toBe('T11');
    expect(labelAt(180, 0)).toBe('Miss');
  });
});
