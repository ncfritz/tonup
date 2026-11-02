import type { PressableProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Pressable } from './Pressable';
import { Text } from './Text';

type Kind = 'primary' | 'secondary';

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
      <Text variant="title" tone={kind === 'primary' ? 'onAccent' : 'text'}>
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
      },
    },
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
}));
