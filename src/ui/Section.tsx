import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

/** A labelled group on a form screen ("GAME", "PLAYERS"). */
export function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.wrap}>
      <Text variant="overline" tone="muted" accessibilityRole="header">
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.s },
}));
