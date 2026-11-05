import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '../icons';
import { Pressable } from '../Pressable';
import { Text } from '../Text';

/**
 * A card holding one chart (docs/design/stats.md): an overline title, the chart drawn at the
 * card's width, and a one-line takeaway under it. A locked card shows its title and a way to
 * Ton Up Pro instead of the chart.
 */
export function ChartCard({
  title,
  takeaway,
  right,
  locked,
  children,
  testID,
}: {
  title: string;
  takeaway?: string | null;
  /** Something small on the title row: a count, a legend. */
  right?: ReactNode;
  locked?: { label: string; a11y: string; onPress: () => void };
  /** Draws the chart for the inner width. */
  children?: (width: number) => ReactNode;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setWidth(Math.floor(e.nativeEvent.layout.width - theme.spacing.l * 2));
  return (
    <View style={styles.card} onLayout={onLayout} testID={testID}>
      <View style={styles.head}>
        <Text variant="overline" tone="muted" accessibilityRole="header" style={styles.flex}>
          {title}
        </Text>
        {locked ? <Icon name="lock" color={theme.colors.accent} size={14} /> : right}
      </View>
      {locked ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locked.a11y}
          style={({ pressed }) => [styles.locked, pressed && styles.pressed]}
          onPress={locked.onPress}
        >
          <Text tone="accent" variant="bodyStrong">
            {locked.label}
          </Text>
        </Pressable>
      ) : (
        <>
          {width > 0 && children ? children(width) : null}
          {takeaway ? <Text>{takeaway}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.s,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
  locked: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.85 },
}));
