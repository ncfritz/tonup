import { useMemo } from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { ringWedges } from './boardPaths';
import { Text } from './Text';

/** The Play button's diameter, its border, and how far it rises above the tab bar. */
export const PLAY_SIZE = 84;
export const PLAY_BORDER = 6;
export const PLAY_RISE = 34;

// Drawn in a 400-unit box: the board's millimetre radii, with the trebles, doubles and bull
// enlarged so they read at this size (as in the design canvas).
const C = 200;
const RINGS = {
  innerSingle: [15.9, 99],
  treble: [95, 111],
  outerSingle: [111, 158],
  double: [158, 174],
} as const;

/**
 * The centre tab: a miniature dartboard in shades of the theme's gold with a PLAY label
 * (docs/design/screens.md → Tab bar). `focused` adds the accent ring.
 */
export function PlayButton({ focused, label }: { focused: boolean; label: string }) {
  const { theme } = useUnistyles();
  const c = theme.colors;
  const wedges = useMemo(
    () => ({
      innerSingle: ringWedges(C, C, ...RINGS.innerSingle),
      treble: ringWedges(C, C, ...RINGS.treble),
      outerSingle: ringWedges(C, C, ...RINGS.outerSingle),
      double: ringWedges(C, C, ...RINGS.double),
    }),
    [],
  );
  return (
    <View style={[styles.ring, focused && styles.ringFocused]}>
      <View style={styles.button}>
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 400"
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Circle cx={C} cy={C} r={200} fill={c.playBase} />
          <G>
            {(['innerSingle', 'outerSingle'] as const).flatMap((ring) =>
              wedges[ring].map((w) => (
                <Path
                  key={`${ring}-${w.segment}`}
                  d={w.d}
                  fill={w.alt ? c.playSegmentAlt : c.playSegment}
                />
              )),
            )}
            {(['treble', 'double'] as const).flatMap((ring) =>
              wedges[ring].map((w) => (
                <Path
                  key={`${ring}-${w.segment}`}
                  d={w.d}
                  fill={w.alt ? c.playRingAlt : c.playRing}
                />
              )),
            )}
          </G>
          <Circle cx={C} cy={C} r={24} fill={c.playSegmentAlt} />
          <Circle cx={C} cy={C} r={11} fill={c.playBase} />
        </Svg>
        <View style={styles.label}>
          <Text style={styles.labelText}>{label}</Text>
        </View>
      </View>
    </View>
  );
}

const RING = 2;

const styles = StyleSheet.create((theme) => ({
  ring: {
    width: PLAY_SIZE + RING * 2,
    height: PLAY_SIZE + RING * 2,
    borderRadius: (PLAY_SIZE + RING * 2) / 2,
    borderWidth: RING,
    borderColor: 'transparent',
  },
  ringFocused: { borderColor: theme.colors.accent },
  button: {
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    borderWidth: PLAY_BORDER,
    borderColor: theme.colors.bg,
    backgroundColor: theme.colors.playBase,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xxs,
    borderRadius: 6,
    // 82% opaque, as in the mockup, so the board shows faintly through.
    backgroundColor: `${theme.colors.playLabelBg}D1`,
  },
  labelText: {
    ...theme.type.overline,
    fontFamily: theme.type.heading.fontFamily,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 1,
    color: theme.colors.playLabel,
  },
}));
