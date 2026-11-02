import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { haptics } from '@/services/haptics';

import { Pressable } from './Pressable';
import { Text } from './Text';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={styles.row}>
      {segments.map((s) => {
        const selected = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={s.label}
            style={[styles.segment, selected && styles.selected]}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(s.value);
            }}
          >
            <Text variant="bodyStrong" tone={selected ? 'onAccent' : 'text'}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radii.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: theme.colors.accent },
}));
