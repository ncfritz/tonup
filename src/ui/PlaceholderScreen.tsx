import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen } from './Screen';
import { Text } from './Text';

/** Scaffold placeholder: a titled tab screen saying which milestone builds it. */
export function PlaceholderScreen({
  title,
  milestone,
  spec,
  overline,
  children,
}: {
  title: string;
  milestone: string;
  spec: string;
  overline?: string;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Screen scroll>
      <View>
        {overline ? (
          <Text variant="overline" tone="accent">
            {overline}
          </Text>
        ) : null}
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.card}>
        <Text variant="bodyStrong">{t('placeholder.comingIn', { milestone })}</Text>
        <Text variant="caption" tone="muted">
          {t('placeholder.spec', { spec })}
        </Text>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.xs,
  },
}));
