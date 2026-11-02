// Shared design foundations, identical in every theme (docs/design/themes.md).
export const spacing = { xxs: 2, xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radii = { s: 8, m: 12, l: 16, xl: 22, pill: 999 } as const;

/** Font family names as registered by @expo-google-fonts (one family per weight). */
export const fonts = {
  displaySemiBold: 'BarlowCondensed_600SemiBold',
  displayBold: 'BarlowCondensed_700Bold',
  displayExtraBold: 'BarlowCondensed_800ExtraBold',
  bodyRegular: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodySemiBold: 'Barlow_600SemiBold',
} as const;

// Sizes from the Pro mockups (docs/design/mockups).
export const type = {
  /** The big remaining score on the scoreboard. */
  score: { fontFamily: fonts.displayExtraBold, fontSize: 56, lineHeight: 58 },
  heading: { fontFamily: fonts.displayExtraBold, fontSize: 34, lineHeight: 38 },
  title: { fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 26 },
  value: { fontFamily: fonts.displayBold, fontSize: 19, lineHeight: 23 },
  /** Uppercase section labels ("QUICK START · YOUR USUAL"). */
  overline: { fontFamily: fonts.displayBold, fontSize: 14, lineHeight: 18, letterSpacing: 1.5 },
  body: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 17 },
  tab: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 13 },
} as const;

export type TypeVariant = keyof typeof type;

export const motion = { quick: 120, base: 200, gentle: 320 } as const;

export const touchTarget = 44;
