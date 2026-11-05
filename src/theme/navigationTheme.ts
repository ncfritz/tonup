import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

/**
 * React Navigation's colours from the current theme, so what a navigator draws itself (the
 * space behind a screen sliding in or out, the card under it) is the screen's own background,
 * not the library's white or black: without it the edges flash during a push or a pop.
 */
export function useNavigationTheme(dark: boolean): Theme {
  const { theme } = useUnistyles();
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.bg,
      card: theme.colors.bg,
      text: theme.colors.text,
      border: theme.colors.line,
    },
  };
}
