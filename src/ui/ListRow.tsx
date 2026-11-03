import type { ReactNode } from 'react';
import { Switch, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from './icons';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** A settings row: label, optional note and value, and a chevron when it opens something. */
export function ListRow({
  label,
  note,
  value,
  onPress,
  right,
  testID,
}: {
  label: string;
  note?: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  const body = (
    <>
      <View style={styles.text}>
        <Text variant="bodyStrong">{label}</Text>
        {note ? (
          <Text variant="caption" tone="muted">
            {note}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text tone="muted" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {right}
      {onPress ? <Icon name="chevron" color={theme.colors.muted} size={18} /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={note}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      testID={testID}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.row} testID={testID}>
      {body}
    </View>
  );
}

/** A row with an on/off switch. */
export function ToggleRow({
  label,
  note,
  value,
  onChange,
  testID,
}: {
  label: string;
  note?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  const { theme } = useUnistyles();
  return (
    <ListRow
      label={label}
      note={note}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ true: theme.colors.accent, false: theme.colors.line }}
          thumbColor={theme.colors.surface}
          testID={testID}
        />
      }
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    minHeight: 56,
    paddingHorizontal: theme.spacing.m,
    paddingVertical: theme.spacing.s,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
  },
  text: { flex: 1, gap: 2 },
  pressed: { opacity: 0.85 },
}));
