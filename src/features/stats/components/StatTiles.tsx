import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/ui';

/** A row (or grid) of headline numbers: "412 · Best". */
export function StatTiles({
  tiles,
  columns = 4,
  a11y,
}: {
  tiles: { label: string; value: string }[];
  columns?: number;
  a11y: (label: string, value: string) => string;
}) {
  return (
    <View style={styles.grid}>
      {tiles.map((t) => (
        <View
          key={t.label}
          style={[styles.tile, { flexBasis: `${100 / columns - 3}%` }]}
          accessible
          accessibilityLabel={a11y(t.label, t.value)}
        >
          <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>
            {t.value}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {t.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.s },
  tile: {
    flexGrow: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    gap: theme.spacing.xxs,
  },
}));
