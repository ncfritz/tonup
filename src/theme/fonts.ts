// Each theme's typefaces (docs/design/themes.md → Theme character), from @expo-google-fonts.
// Weights are imported one file at a time so only the ones we use are bundled.
import { Barlow_400Regular } from '@expo-google-fonts/barlow/400Regular';
import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold';
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold';
import { BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed/800ExtraBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { JetBrainsMono_800ExtraBold } from '@expo-google-fonts/jetbrains-mono/800ExtraBold';
import { Kalam_400Regular } from '@expo-google-fonts/kalam/400Regular';
import { Kalam_700Bold } from '@expo-google-fonts/kalam/700Bold';
import { LibreFranklin_400Regular } from '@expo-google-fonts/libre-franklin/400Regular';
import { LibreFranklin_500Medium } from '@expo-google-fonts/libre-franklin/500Medium';
import { LibreFranklin_600SemiBold } from '@expo-google-fonts/libre-franklin/600SemiBold';
import { Orbitron_600SemiBold } from '@expo-google-fonts/orbitron/600SemiBold';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { Orbitron_800ExtraBold } from '@expo-google-fonts/orbitron/800ExtraBold';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker/400Regular';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display/700Bold';
import { PlayfairDisplay_800ExtraBold } from '@expo-google-fonts/playfair-display/800ExtraBold';
import { Rajdhani_500Medium } from '@expo-google-fonts/rajdhani/500Medium';
import { Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani/600SemiBold';
import { Rajdhani_700Bold } from '@expo-google-fonts/rajdhani/700Bold';

/** Every font file the app loads at start (src/app/_layout.tsx). */
export const FONT_ASSETS = {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
  PermanentMarker_400Regular,
  Kalam_400Regular,
  Kalam_700Bold,
  Orbitron_600SemiBold,
  Orbitron_700Bold,
  Orbitron_800ExtraBold,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  LibreFranklin_400Regular,
  LibreFranklin_500Medium,
  LibreFranklin_600SemiBold,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};

type FontName = keyof typeof FONT_ASSETS;

/** A theme's typefaces: display for scores, headings and titles, body for everything else. */
export interface FontSet {
  displaySemiBold: FontName;
  displayBold: FontName;
  displayExtraBold: FontName;
  bodyRegular: FontName;
  bodyMedium: FontName;
  bodySemiBold: FontName;
  /**
   * Display faces differ in width: Orbitron and JetBrains Mono run wide, so their sizes come
   * down to fit the same layouts.
   */
  displayScale: number;
  /** Letter case for headings and overlines; Permanent Marker reads better as written. */
  upper: boolean;
}

export const FONT_SETS = {
  pro: {
    displaySemiBold: 'BarlowCondensed_600SemiBold',
    displayBold: 'BarlowCondensed_700Bold',
    displayExtraBold: 'BarlowCondensed_800ExtraBold',
    bodyRegular: 'Barlow_400Regular',
    bodyMedium: 'Barlow_500Medium',
    bodySemiBold: 'Barlow_600SemiBold',
    displayScale: 1,
    upper: true,
  },
  chalkboard: {
    displaySemiBold: 'PermanentMarker_400Regular',
    displayBold: 'PermanentMarker_400Regular',
    displayExtraBold: 'PermanentMarker_400Regular',
    bodyRegular: 'Kalam_400Regular',
    bodyMedium: 'Kalam_400Regular',
    bodySemiBold: 'Kalam_700Bold',
    displayScale: 0.88,
    upper: false,
  },
  arcade: {
    displaySemiBold: 'Orbitron_600SemiBold',
    displayBold: 'Orbitron_700Bold',
    displayExtraBold: 'Orbitron_800ExtraBold',
    bodyRegular: 'Rajdhani_500Medium',
    bodyMedium: 'Rajdhani_600SemiBold',
    bodySemiBold: 'Rajdhani_700Bold',
    displayScale: 0.74,
    upper: true,
  },
  heritage: {
    displaySemiBold: 'PlayfairDisplay_600SemiBold',
    displayBold: 'PlayfairDisplay_700Bold',
    displayExtraBold: 'PlayfairDisplay_800ExtraBold',
    bodyRegular: 'LibreFranklin_400Regular',
    bodyMedium: 'LibreFranklin_500Medium',
    bodySemiBold: 'LibreFranklin_600SemiBold',
    displayScale: 0.86,
    upper: false,
  },
  training: {
    displaySemiBold: 'JetBrainsMono_600SemiBold',
    displayBold: 'JetBrainsMono_700Bold',
    displayExtraBold: 'JetBrainsMono_800ExtraBold',
    bodyRegular: 'Inter_400Regular',
    bodyMedium: 'Inter_500Medium',
    bodySemiBold: 'Inter_600SemiBold',
    displayScale: 0.78,
    upper: true,
  },
} as const satisfies Record<string, FontSet>;
