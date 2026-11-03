import { FONT_SETS } from './fonts';
import palettes from './palettes.json';
import { motion, radii, spacing, typeFor } from './tokens';

/** The five themes (docs/design/themes.md); Pro is in the base app, the rest are Ton Up Pro. */
export type ThemeId = keyof typeof palettes;
export type Mode = 'light' | 'dark';
export type ColorTokens = (typeof palettes)['pro']['dark'];

export const THEME_IDS = Object.keys(palettes) as ThemeId[];

/** How a theme draws things beyond colour: dart markers and letter case. */
export interface Look {
  /** Arcade's darts glow with a ring; the others are solid dots with an outline. */
  marker: 'dot' | 'glow';
  /** Outline width of a dart marker, in points. */
  markerStroke: number;
  /** Headings and overlines in capitals. */
  upper: boolean;
}

const LOOKS: Record<ThemeId, Look> = {
  pro: { marker: 'dot', markerStroke: 3, upper: true },
  chalkboard: { marker: 'dot', markerStroke: 3, upper: false },
  arcade: { marker: 'glow', markerStroke: 2, upper: true },
  heritage: { marker: 'dot', markerStroke: 3, upper: false },
  training: { marker: 'dot', markerStroke: 2.5, upper: true },
};

const make = (id: ThemeId, mode: Mode) =>
  ({
    colors: palettes[id][mode] as ColorTokens,
    spacing,
    radii,
    type: typeFor(FONT_SETS[id]),
    look: LOOKS[id],
    motion,
  }) as const;

// Named themes are `<theme>-<mode>` (ADR 0010). Every theme defines every token.
export const appThemes = {
  'pro-dark': make('pro', 'dark'),
  'pro-light': make('pro', 'light'),
  'chalkboard-dark': make('chalkboard', 'dark'),
  'chalkboard-light': make('chalkboard', 'light'),
  'arcade-dark': make('arcade', 'dark'),
  'arcade-light': make('arcade', 'light'),
  'heritage-dark': make('heritage', 'dark'),
  'heritage-light': make('heritage', 'light'),
  'training-dark': make('training', 'dark'),
  'training-light': make('training', 'light'),
};

export type AppThemeName = keyof typeof appThemes;
export type AppTheme = (typeof appThemes)[AppThemeName];

export const themeName = (theme: ThemeId, mode: Mode): AppThemeName => `${theme}-${mode}`;
