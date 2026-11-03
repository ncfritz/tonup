import { create } from 'zustand';

import type { PlayerRef } from '@/domain/darts';
import type { GameId } from '@/domain/games';
import type { ThemeId } from '@/theme/themes';

export type AppearanceSetting = 'system' | 'light' | 'dark';

export interface Settings {
  /** Pro is the base theme and the default (ADR 0009). */
  theme: ThemeId;
  appearance: AppearanceSetting;
  haptics: boolean;
  /** The caller reads out each visit (expo-speech, on the phone). */
  caller: boolean;
  /** Favourite double for checkout routes (breaks ties); null for none. */
  preferredDouble: number | null;
  /** How the scoring screen opens. */
  defaultInput: 'board' | 'keypad';
  /**
   * The last game played (a rules-library id such as 'x01' or 'tactics',
   * src/features/game/presets.ts), settings per game engine, and the line-up, for New game and
   * Quick start.
   */
  lastGameId: string;
  gameSettings: Partial<Record<GameId, unknown>>;
  lastLineup: PlayerRef[] | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'pro',
  appearance: 'system',
  haptics: true,
  caller: true,
  preferredDouble: null,
  defaultInput: 'board',
  lastGameId: 'x01',
  gameSettings: {},
  lastLineup: null,
};

type Persist = (key: string, value: unknown) => void;
let persist: Persist = () => {};

/** Where settings are saved; set at startup to the settings table (src/app/_layout.tsx). */
export function setSettingsPersistence(fn: Persist) {
  persist = fn;
}

const valid: { [K in keyof Settings]: (v: unknown) => v is Settings[K] } = {
  theme: (v): v is ThemeId => v === 'pro',
  appearance: (v): v is AppearanceSetting => v === 'system' || v === 'light' || v === 'dark',
  haptics: (v): v is boolean => typeof v === 'boolean',
  caller: (v): v is boolean => typeof v === 'boolean',
  preferredDouble: (v): v is number | null =>
    v === null ||
    (typeof v === 'number' && Number.isInteger(v) && ((v >= 1 && v <= 20) || v === 25)),
  defaultInput: (v): v is 'board' | 'keypad' => v === 'board' || v === 'keypad',
  lastGameId: (v): v is string => typeof v === 'string' && v.length > 0 && v.length < 40,
  gameSettings: (v): v is Partial<Record<GameId, unknown>> =>
    typeof v === 'object' && v !== null && !Array.isArray(v),
  lastLineup: (v): v is PlayerRef[] | null =>
    v === null ||
    (Array.isArray(v) &&
      v.length > 0 &&
      v.every((p) => typeof p?.id === 'string' && typeof p?.name === 'string')),
};

interface SettingsStore extends Settings {
  /** Fills the store from stored values, ignoring anything unknown or malformed. */
  hydrate: (stored: Record<string, unknown>) => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  hydrate: (stored) => {
    const next: Partial<Settings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const v = stored[key];
      if (valid[key](v)) (next as Record<string, unknown>)[key] = v;
    }
    set(next);
  },
  set: (key, value) => {
    set({ [key]: value } as Partial<Settings>);
    persist(key, value);
  },
}));
