import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { UnistylesRuntime } from 'react-native-unistyles';

import { useSettings } from '@/features/settings/store';

import { themeName } from './themes';

/** Keeps the Unistyles theme in step with the theme and appearance settings. */
export function ThemeSync() {
  const theme = useSettings((s) => s.theme);
  const appearance = useSettings((s) => s.appearance);
  const system = useColorScheme();

  useEffect(() => {
    const mode = appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance;
    UnistylesRuntime.setTheme(themeName(theme, mode));
  }, [theme, appearance, system]);

  return null;
}
