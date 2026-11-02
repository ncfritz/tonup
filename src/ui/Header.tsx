import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Path, Rect } from 'react-native-svg';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** A screen header: a back (or pause) button, a title, and anything on the right. */
export function Header({
  title,
  onBack,
  backLabel,
  icon = 'back',
  right,
}: {
  title: string;
  onBack: () => void;
  backLabel: string;
  icon?: 'back' | 'pause';
  right?: ReactNode;
}) {
  const { theme } = useUnistyles();
  const c = theme.colors.text;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        style={styles.button}
        onPress={onBack}
        testID="header-back"
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2.5}>
          {icon === 'pause' ? (
            <>
              <Rect x={6} y={5} width={4} height={14} rx={1} fill={c} stroke="none" />
              <Rect x={14} y={5} width={4} height={14} rx={1} fill={c} stroke="none" />
            </>
          ) : (
            <Path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </Svg>
      </Pressable>
      <Text
        variant="overline"
        tone="muted"
        style={styles.title}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  button: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 16 },
}));
