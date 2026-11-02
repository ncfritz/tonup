// The rules library (docs/data/game-rules.md): 26 games, each with its text in rules.json and,
// where the app can play it, how to start it. Rules for Pro games stay readable (ADR 0009).
import { useTranslation } from 'react-i18next';

import type { GameId } from '@/domain/games';

export type RulesFamily = 'x01' | 'cricket' | 'sequence' | 'elimination' | 'sports';

export interface RulesEntry {
  id: string;
  family: RulesFamily;
  /** How to start it in the app: a game (with settings) or a drill. Null when it's Pro. */
  play:
    { kind: 'game'; game: GameId; variant?: string } | { kind: 'drill'; drill: 'countUp' } | null;
}

export const RULES: RulesEntry[] = [
  { id: 'x01', family: 'x01', play: { kind: 'game', game: 'x01' } },
  { id: 'dido201', family: 'x01', play: null },
  { id: 'gotcha', family: 'x01', play: null },
  { id: 'fives', family: 'x01', play: null },
  {
    id: 'cricket',
    family: 'cricket',
    play: { kind: 'game', game: 'cricket', variant: 'standard' },
  },
  {
    id: 'cutThroat',
    family: 'cricket',
    play: { kind: 'game', game: 'cricket', variant: 'cutThroat' },
  },
  { id: 'noScore', family: 'cricket', play: null },
  { id: 'tactics', family: 'cricket', play: null },
  { id: 'randomCricket', family: 'cricket', play: null },
  { id: 'mickeyMouse', family: 'cricket', play: null },
  { id: 'killerCricket', family: 'cricket', play: null },
  { id: 'clock', family: 'sequence', play: { kind: 'game', game: 'clock' } },
  { id: 'nineLives', family: 'sequence', play: null },
  { id: 'hareHounds', family: 'sequence', play: null },
  { id: 'shanghai', family: 'sequence', play: { kind: 'game', game: 'shanghai' } },
  { id: 'halveIt', family: 'sequence', play: null },
  { id: 'bermuda', family: 'sequence', play: null },
  { id: 'countUp', family: 'sequence', play: { kind: 'drill', drill: 'countUp' } },
  { id: 'killer', family: 'elimination', play: { kind: 'game', game: 'killer' } },
  { id: 'blindKiller', family: 'elimination', play: null },
  { id: 'scam', family: 'elimination', play: null },
  { id: 'baseball', family: 'sports', play: null },
  { id: 'bullseyeBaseball', family: 'sports', play: null },
  { id: 'golf', family: 'sports', play: null },
  { id: 'football', family: 'sports', play: null },
  { id: 'ticTacToe', family: 'sports', play: null },
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
