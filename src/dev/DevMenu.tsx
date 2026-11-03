import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from '@/ui';

/**
 * Developer tools, shown at the bottom of Settings in dev builds. Settings itself now has
 * appearance, haptics and the caller; seed data and resets land here as they're needed.
 */
export function DevMenu() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text variant="overline" tone="muted">
        {t('dev.title')}
      </Text>
      <Text variant="caption" tone="muted">
        {t('dev.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.xs, marginTop: theme.spacing.m },
}));
