import type { FontSet } from './fonts';

// Shared design foundations, identical in every theme (docs/design/themes.md).
export const spacing = { xxs: 2, xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radii = { s: 8, m: 12, l: 16, xl: 22, pill: 999 } as const;

// Sizes from the Pro mockups (docs/design/mockups); other themes scale their display face.
export function typeFor(f: FontSet) {
  const d = (n: number) => Math.round(n * f.displayScale);
  // Line heights shrink less than sizes: the other display faces sit taller in their line.
  const lh = (n: number) => Math.round(n * Math.max(f.displayScale, 0.92));
  return {
    /** The big remaining score on the scoreboard. */
    score: { fontFamily: f.displayExtraBold, fontSize: d(56), lineHeight: lh(58) },
    heading: { fontFamily: f.displayExtraBold, fontSize: d(34), lineHeight: lh(38) },
    title: { fontFamily: f.displayBold, fontSize: d(22), lineHeight: lh(26) },
    value: { fontFamily: f.displayBold, fontSize: d(19), lineHeight: lh(23) },
    /** Uppercase section labels ("QUICK START · YOUR USUAL") where the theme uses capitals. */
    overline: {
      fontFamily: f.displayBold,
      fontSize: d(14),
      lineHeight: lh(18),
      letterSpacing: f.upper ? 1.5 : 0.3,
    },
    body: { fontFamily: f.bodyMedium, fontSize: 16, lineHeight: 22 },
    bodyStrong: { fontFamily: f.bodySemiBold, fontSize: 16, lineHeight: 22 },
    caption: { fontFamily: f.bodyMedium, fontSize: 13, lineHeight: 17 },
    tab: { fontFamily: f.bodySemiBold, fontSize: 11, lineHeight: 13 },
  } as const;
}

export type TypeScale = ReturnType<typeof typeFor>;
export type TypeVariant = keyof TypeScale;
export const motion = { quick: 120, base: 200, gentle: 320 } as const;

export const touchTarget = 44;
