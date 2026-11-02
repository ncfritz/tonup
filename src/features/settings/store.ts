import { create } from 'zustand';

import type { ThemeId } from '@/theme/themes';

export type AppearanceSetting = 'system' | 'light' | 'dark';

export interface Settings {
  /** Pro is the base theme and the default (ADR 0009). */
  theme: ThemeId;
  appearance: AppearanceSetting;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'pro',
  appearance: 'system',
  haptics: true,
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
