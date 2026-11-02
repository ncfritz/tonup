import { router } from 'expo-router';

import { useRulesT } from '@/content/rules';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { SEGMENT_ORDER } from '@/domain/board';
import { Board, Header, Screen, Section, Text } from '@/ui';

/** Hanging the board and where to stand (docs/data/game-rules.md → Board setup). */
export default function BoardSetup() {
  const { t } = useRulesT();
  const rows = [
    ['height', 'heightValue'],
    ['oche', 'ocheValue'],
    ['diagonal', 'diagonalValue'],
  ] as const;
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('board.title')} backLabel={t('page.back')} onBack={() => router.back()} />
      <View style={styles.center}>
        <Board size={240} accessibilityLabel={t('board.a11y')} />
      </View>
      <Section label={t('board.steel')}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text variant="bodyStrong">{t(`board.${k}`)}</Text>
            <Text tone="muted">{t(`board.${v}`)}</Text>
          </View>
        ))}
      </Section>
      <Section label={t('board.soft')}>
        <Text>{t('board.softValue')}</Text>
      </Section>
      <Text>{t('board.orientation', { order: SEGMENT_ORDER.join(', ') })}</Text>
      <Text>{t('board.rings')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  center: { alignItems: 'center' },
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    gap: 2,
  },
}));
