import { Text as RNText, type TextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { TypeVariant } from '@/theme/tokens';

type Tone = 'text' | 'muted' | 'accent' | 'onAccent' | 'danger' | 'onDanger' | 'pending' | 'info';

/**
 * How far each style grows with Dynamic Type. Body text follows the setting up to double; the
 * big display styles stop earlier so scores and headings still fit their rows (M15).
 */
const MAX_SCALE: Record<TypeVariant, number> = {
  score: 1.3,
  tab: 1.3,
  heading: 1.4,
  title: 1.5,
  value: 1.5,
  overline: 1.6,
  body: 2,
  bodyStrong: 2,
  caption: 2,
};

export function Text({
  variant = 'body',
  tone = 'text',
  style,
  ...props
}: TextProps & { variant?: TypeVariant; tone?: Tone }) {
  styles.useVariants({ variant, tone });
  return (
    <RNText maxFontSizeMultiplier={MAX_SCALE[variant]} style={[styles.text, style]} {...props} />
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
        pending: { color: theme.colors.pending },
        info: { color: theme.colors.info },
      },
    },
  },
}));
