import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { useSettings } from '@/features/settings/store';

import { themeName, type Mode, type ThemeId } from './themes';

/** The mode showing for an appearance setting: light or dark, or the system's. */
export function useMode(appearance: 'system' | Mode): Mode {
  const system = useColorScheme();
  return appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance;
}

/** Keeps the Unistyles theme in step with a theme and appearance (Ton Up's, or Capture's). */
export function useApplyTheme(theme: ThemeId, appearance: 'system' | Mode): Mode {
  const mode = useMode(appearance);
  useEffect(() => {
    UnistylesRuntime.setTheme(themeName(theme, mode));
  }, [theme, mode]);
  return mode;
}

/** Keeps the Unistyles theme in step with the theme and appearance settings. */
export function ThemeSync() {
  const theme = useSettings((s) => s.theme);
  const appearance = useSettings((s) => s.appearance);
  useApplyTheme(theme, appearance);
  return null;
}
