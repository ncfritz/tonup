import { StyleSheet } from 'react-native-unistyles';

import { appThemes } from './themes';

const breakpoints = { xs: 0, md: 600 } as const;

type AppThemes = typeof appThemes;
type AppBreakpoints = typeof breakpoints;

// Declaration merging per the Unistyles docs; the empty interfaces are intentional.
/* eslint-disable @typescript-eslint/no-empty-object-type */
declare module 'react-native-unistyles' {
  export interface UnistylesThemes extends AppThemes {}
  export interface UnistylesBreakpoints extends AppBreakpoints {}
}
/* eslint-enable @typescript-eslint/no-empty-object-type */

// We pick the theme ourselves from the theme and appearance settings (ADR 0010), so adaptive
// themes stay off. ThemeSync updates it at runtime.
StyleSheet.configure({
  themes: appThemes,
  breakpoints,
  settings: { initialTheme: 'pro-dark' },
});
