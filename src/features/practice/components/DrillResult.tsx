import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { beats, type DrillDefinition } from '@/domain/drills';
import { label } from '@/domain/darts';
import { formatStat } from '@/features/game/format';
import { Button, Text } from '@/ui';

import type { DrillScore } from '../bests';

/** The end of a drill: the score against your best, its stats, Try again. */
export function DrillResult({
  def,
  state,
  best,
  onAgain,
  onClose,
}: {
  def: DrillDefinition<unknown, unknown>;
  state: unknown;
  /** Your best before this go. */
  best: DrillScore | null;
  onAgain: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('practice');
  const { t: tg } = useTranslation('game');
  const score = def.score(state);
  const lines = def.stats(state, 'you');
  const gap = best ? Math.abs(score - best.score) : 0;
  const verdict = !best
    ? t('result.first', { score })
    : beats(def.better, score, best.score)
      ? t('result.newBest')
      : score === best.score
        ? t('result.matchedBest')
        : t('result.missedBest', { gap, best: best.score });
  const target = def.targetFor(state);
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Text variant="overline" tone="muted">
        {def.failed(state) && target === null
          ? t('result.failed', { target: lastTarget(def, state) })
          : t('result.done')}
      </Text>
      <Text variant="score" tone="accent">
        {score}
      </Text>
      <Text variant="title">{verdict}</Text>
      <View style={styles.lines}>
        {lines.map((l) => (
          <View key={l.key} style={styles.line}>
            <Text tone="muted">{tg(`stats.${l.key}` as 'stats.mpr')}</Text>
            <Text variant="bodyStrong">
              {l.key === 'costliestDouble' && l.value !== null
                ? label({ segment: l.value, multiplier: 2 })
                : formatStat(l)}
            </Text>
          </View>
        ))}
      </View>
      <Button label={t('result.tryAgain')} onPress={onAgain} testID="try-again" />
      <Button kind="secondary" label={t('result.close')} onPress={onClose} />
    </View>
  );
}

/** The step the drill ended on (Bob's 27 when it drops to zero). */
function lastTarget(def: DrillDefinition<unknown, unknown>, state: unknown): string {
  const steps = def.steps(state);
  const lastPlayed = [...steps].reverse().find((s) => s.state === 'missed' || s.state === 'done');
  return lastPlayed?.label ?? '';
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flex: 1,
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.xl,
    justifyContent: 'center',
  },
  lines: { gap: theme.spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
}));
