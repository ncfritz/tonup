import { GAME_IDS } from '@/domain/games';

import rules from '../i18n/locales/en/rules.json';

import { FAMILIES, matches, RULES, rulesEntry } from './rules';

const text = rules.games as Record<string, Record<string, unknown>>;

describe('rules library', () => {
  it('has all 26 games from the rules doc, each once', () => {
    expect(RULES).toHaveLength(26);
    expect(new Set(RULES.map((r) => r.id)).size).toBe(26);
    expect(Object.keys(text).sort()).toEqual(RULES.map((r) => r.id).sort());
    for (const r of RULES) expect(FAMILIES).toContain(r.family);
  });

  it('has the full text for every game', () => {
    for (const r of RULES) {
      const g = text[r.id]!;
      for (const k of ['name', 'summary', 'players']) expect(typeof g[k]).toBe('string');
      for (const k of ['how', 'scoring', 'win']) {
        expect(Array.isArray(g[k]) && (g[k] as string[]).length > 0).toBe(true);
      }
      expect(Array.isArray(g.variants)).toBe(true);
    }
  });

  it('links every game the app can play, and only those', () => {
    const played = RULES.flatMap((r) => (r.play?.kind === 'game' ? [r.play.game] : []));
    expect(new Set(played)).toEqual(new Set(GAME_IDS));
    expect(rulesEntry('golf')?.play).toBeNull();
    expect(rulesEntry('nope')).toBeNull();
  });

  it('searches without minding case or accents', () => {
    expect(matches('CRICK', 'Cut-Throat Cricket')).toBe(true);
    expect(matches('cafe', 'Café rules')).toBe(true);
    expect(matches('', 'anything')).toBe(true);
    expect(matches('zzz', 'Killer')).toBe(false);
  });
});
