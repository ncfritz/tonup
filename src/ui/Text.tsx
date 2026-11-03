import { Text as RNText, type TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { TypeVariant } from '@/theme/tokens';

type Tone = 'text' | 'muted' | 'accent' | 'onAccent' | 'danger' | 'onDanger';

export function Text({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: TextProps & { variant?: TypeVariant; tone?: Tone }) {
  styles.useVariants({ variant, tone });
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'score' || variant === 'tab' ? 1.3 : undefined}
      style={[styles.text, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  text: {
    variants: {
      variant: {
        score: theme.type.score,
        heading: { ...theme.type.heading, textTransform: theme.look.upper ? 'uppercase' : 'none' },
        title: theme.type.title,
        value: theme.type.value,
        overline: {
          ...theme.type.overline,
          textTransform: theme.look.upper ? 'uppercase' : 'none',
        },
        body: theme.type.body,
        bodyStrong: theme.type.bodyStrong,
        caption: theme.type.caption,
        tab: theme.type.tab,
      },
      tone: {
        text: { color: theme.colors.text },
        muted: { color: theme.colors.muted },
        accent: { color: theme.colors.accent },
        onAccent: { color: theme.colors.onAccent },
        danger: { color: theme.colors.danger },
        onDanger: { color: theme.colors.onDanger },
      },
    },
  },
}));
