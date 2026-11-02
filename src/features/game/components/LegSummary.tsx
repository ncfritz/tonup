import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { X01State } from '@/domain/games/x01';
import { Button, Text } from '@/ui';

/** Shown over the input after a leg is won, until Next leg (docs/design/screens.md). */
export function LegSummary({
  state,
  onNext,
  onUndo,
}: {
  state: X01State;
  onNext: () => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation('game');
  const last = state.visits[state.visits.length - 1];
  if (!last?.checkout) return null;
  const winner = state.players[last.player]!;
  const legVisits = state.visits.filter((v) => v.leg === last.leg && v.player === last.player);
  const darts = legVisits.reduce((n, v) => n + v.darts.length, 0);
  const points = state.settings.startScore;
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text variant="heading" accessibilityRole="header">
        {t('legSummary.title', { leg: last.leg + 1, name: winner.name })}
      </Text>
      <Text>{t('legSummary.body', { darts, checkout: last.scored })}</Text>
      <Text tone="muted">
        {t('legSummary.average', { average: ((points / darts) * 3).toFixed(1) })}
      </Text>
      <Button label={t('actions.nextLeg')} onPress={onNext} testID="next-leg" />
      <Button kind="secondary" label={t('actions.undo')} onPress={onUndo} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.xl,
  },
}));
