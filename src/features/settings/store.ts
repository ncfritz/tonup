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

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

// In memory for now; saved to SQLite from M2 (docs/plan/v1-implementation.md).
export const useSettings = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,
  set: (key, value) => set({ [key]: value } as Partial<Settings>),
}));
