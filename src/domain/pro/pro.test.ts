import {
  BASE_THEME,
  canPlayGame,
  canPlayRules,
  canUseAnalysis,
  canUseCamera,
  canUseDrill,
  canUseTheme,
} from '.';

describe('Ton Up Pro (ADR 0009)', () => {
  it('keeps the base games, drills and theme free', () => {
    for (const g of ['x01', 'clock', 'shanghai', 'killer'])
      expect(canPlayGame(g, false)).toBe(true);
    expect(canPlayGame('cricket', false, 'standard')).toBe(true);
    expect(canPlayGame('cricket', false, 'cutThroat')).toBe(true);
    for (const d of ['bobs27', 'countUp', 'clock']) expect(canUseDrill(d, false)).toBe(true);
    expect(canUseTheme(BASE_THEME, false)).toBe(true);
    expect(canPlayRules('cutThroat', false)).toBe(true);
    expect(canPlayRules('countUp', false)).toBe(false);
    expect(canPlayRules('dido201', false)).toBe(false);
  });

  it('locks the rest until Pro, then opens everything', () => {
    expect(canPlayGame('golf', false)).toBe(false);
    expect(canPlayGame('cricket', false, 'tactics')).toBe(false);
    expect(canPlayRules('golf', false)).toBe(false);
    expect(canUseDrill('catch40', false)).toBe(false);
    expect(canUseTheme('arcade', false)).toBe(false);
    expect(canUseAnalysis(false)).toBe(false);
    expect(canUseCamera(false)).toBe(false);
    expect(canPlayGame('golf', true)).toBe(true);
    expect(canUseTheme('arcade', true)).toBe(true);
    expect(canUseAnalysis(true)).toBe(true);
  });
});
