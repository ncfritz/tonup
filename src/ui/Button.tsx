import type { PressableProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Pressable } from './Pressable';
import { Text } from './Text';

/** Danger: for stopping or throwing work away (cancel a run). */
type Kind = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  kind = 'primary',
  ...props
}: PressableProps & { label: string; kind?: Kind }) {
  styles.useVariants({ kind });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        props.disabled && styles.disabled,
      ]}
      {...props}
    >
      <Text variant="title" tone={kind === 'primary' ? 'onAccent' : kind === 'danger' ? 'onDanger' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    minHeight: 52,
    borderRadius: theme.radii.m,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    variants: {
      kind: {
        primary: { backgroundColor: theme.colors.accent },
        secondary: { backgroundColor: theme.colors.surface },
        danger: { backgroundColor: theme.colors.danger },
      },
    },
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
}));
