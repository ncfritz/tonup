import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Screen, Text } from '@/ui';

/** Capture home. Sessions, the outbox and the Lab connection arrive in L2 (capture-lab.md). */
export default function CaptureHome() {
  const { t } = useTranslation('capture');
  return (
    <Screen edges={['top', 'bottom']}>
      <View>
        <Text variant="heading" accessibilityRole="header">
          {t('home.title')}
        </Text>
        <Text tone="muted">{t('home.subtitle')}</Text>
      </View>
      <View style={styles.card}>
        <Text variant="bodyStrong">{t('home.comingSoon')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
}));
