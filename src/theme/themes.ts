import palettes from './palettes.json';
import { motion, radii, spacing, type } from './tokens';

/** Themes with palettes so far. Chalkboard, Arcade, Heritage and Training arrive in M14. */
export type ThemeId = keyof typeof palettes;
export type Mode = 'light' | 'dark';
export type ColorTokens = (typeof palettes)['pro']['dark'];

const make = (colors: ColorTokens) => ({ colors, spacing, radii, type, motion }) as const;

// Named themes are `<theme>-<mode>` (ADR 0010). Every theme defines every token.
export const appThemes = {
  'pro-dark': make(palettes.pro.dark),
  'pro-light': make(palettes.pro.light),
};

export type AppThemeName = keyof typeof appThemes;
export type AppTheme = (typeof appThemes)[AppThemeName];

export const themeName = (theme: ThemeId, mode: Mode): AppThemeName => `${theme}-${mode}`;
