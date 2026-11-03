import { FONT_ASSETS, FONT_SETS } from './fonts';
import palettes from './palettes.json';
import { appThemes, THEME_IDS } from './themes';

describe('themes (docs/design/themes.md)', () => {
  it('has all five themes in light and dark, each with every token', () => {
    expect(THEME_IDS).toEqual(['pro', 'chalkboard', 'arcade', 'heritage', 'training']);
    expect(Object.keys(appThemes)).toHaveLength(10);
    const keys = Object.keys(palettes.pro.dark).sort();
    for (const id of THEME_IDS) {
      for (const mode of ['light', 'dark'] as const) {
        expect(Object.keys(palettes[id][mode]).sort()).toEqual(keys);
        for (const v of Object.values(palettes[id][mode])) expect(v).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });

  it('only uses fonts that are loaded', () => {
    for (const id of THEME_IDS) {
      for (const [k, v] of Object.entries(FONT_SETS[id])) {
        if (typeof v === 'string') expect(FONT_ASSETS).toHaveProperty(v, expect.anything());
        else expect(k === 'displayScale' || k === 'upper').toBe(true);
      }
      const type = appThemes[`${id}-dark`].type;
      for (const t of Object.values(type)) expect(FONT_ASSETS).toHaveProperty(t.fontFamily);
    }
  });
});
