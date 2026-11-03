// The rules library (docs/data/game-rules.md): 26 games, each with its text in rules.json and,
// where the app can play it, how to start it. Rules for Pro games stay readable (ADR 0009).
import { useTranslation } from 'react-i18next';

export type RulesFamily = 'x01' | 'cricket' | 'sequence' | 'elimination' | 'sports';

export interface RulesEntry {
  /** Also the preset that plays it (src/features/game/presets.ts). */
  id: string;
  family: RulesFamily;
  /** A drill that practises it on your own, open to everyone. */
  drill?: 'countUp' | 'clock';
}

export const RULES: RulesEntry[] = [
  { id: 'x01', family: 'x01' },
  { id: 'dido201', family: 'x01' },
  { id: 'gotcha', family: 'x01' },
  { id: 'fives', family: 'x01' },
  { id: 'cricket', family: 'cricket' },
  { id: 'cutThroat', family: 'cricket' },
  { id: 'noScore', family: 'cricket' },
  { id: 'tactics', family: 'cricket' },
  { id: 'randomCricket', family: 'cricket' },
  { id: 'mickeyMouse', family: 'cricket' },
  { id: 'killerCricket', family: 'cricket' },
  { id: 'clock', family: 'sequence', drill: 'clock' },
  { id: 'nineLives', family: 'sequence' },
  { id: 'hareHounds', family: 'sequence' },
  { id: 'shanghai', family: 'sequence' },
  { id: 'halveIt', family: 'sequence' },
  { id: 'bermuda', family: 'sequence' },
  { id: 'countUp', family: 'sequence', drill: 'countUp' },
  { id: 'killer', family: 'elimination' },
  { id: 'blindKiller', family: 'elimination' },
  { id: 'scam', family: 'elimination' },
  { id: 'baseball', family: 'sports' },
  { id: 'bullseyeBaseball', family: 'sports' },
  { id: 'golf', family: 'sports' },
  { id: 'football', family: 'sports' },
  { id: 'ticTacToe', family: 'sports' },
];

export const FAMILIES: RulesFamily[] = ['x01', 'cricket', 'sequence', 'elimination', 'sports'];

export const rulesEntry = (id: string) => RULES.find((r) => r.id === id) ?? null;

/** Matches a search against text, ignoring case and accents. */
export function matches(query: string, ...texts: string[]): boolean {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  return texts.some((t) => norm(t).includes(q));
}

type Loose = (key: string, options?: Record<string, unknown>) => unknown;

/**
 * The rules text, outside the typed i18n keys (its long lists make typed keys too deep for the
 * compiler; src/i18n/i18next.d.ts). `t` gives a string and `list` an array; tests check every
 * game's keys exist (src/content/rules.test.ts).
 */
export function useRulesT() {
  const { i18n } = useTranslation();
  const raw = i18n.t.bind(i18n) as unknown as Loose;
  return {
    t: (key: string, options?: Record<string, unknown>) => String(raw(`rules:${key}`, options)),
    list: <T = string>(key: string): T[] => {
      const v = raw(`rules:${key}`, { returnObjects: true });
      return Array.isArray(v) ? (v as T[]) : [];
    },
  };
}
