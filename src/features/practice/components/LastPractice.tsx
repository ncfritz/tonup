import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { label } from '@/domain/darts';
import { beats, drills } from '@/domain/drills';
import { Pressable, Text } from '@/ui';

import { dayLabel } from '../../game/when';
import type { PracticeCard } from '../bests';
import { startPractice } from '../start';

/**
 * Your last practice (docs/design/screens.md → Practice tab): its score against your best, a
 * small trend of recent goes, the double that cost the most, and Try again.
 */
export function LastPractice({ card, now }: { card: PracticeCard; now: number }) {
  const { t } = useTranslation('game');
  const { t: tp } = useTranslation('practice');
  const { theme } = useUnistyles();
  const drill = drills[card.drillId];
  const name = tp(`drills.${card.drillId}.name` as 'drills.bobs27.name');
  const when = dayLabel(card.endedAt, now, {
    today: t('home.today'),
    yesterday: t('home.yesterday'),
  });
  const b = card.best;
  const versus = !b
    ? tp('home.first')
    : beats(drill.better, card.score, b.score)
      ? tp('home.best')
      : card.score === b.score
        ? tp('home.level')
        : tp('home.short', { gap: Math.abs(card.score - b.score), best: b.score });
  const again = () => {
    const id = startPractice(card.drillId, t('players.you'), card.game.session.settings);
    router.push({ pathname: '/drill/[sessionId]', params: { sessionId: id } });
  };
  return (
    <View style={styles.card} testID="last-practice">
      <Trend
        values={card.trend}
        color={theme.colors.accent}
        line={theme.colors.line}
        label={tp('home.trendA11y', { drill: name })}
      />
      <View style={styles.flex}>
        <Text variant="overline" tone="muted">
          {tp('home.lastPractice', { when })}
        </Text>
        <Text variant="title">{tp('home.title', { drill: name, score: card.score })}</Text>
        <Text variant="caption" tone="muted">
          {card.costliest !== null
            ? `${versus} · ${tp('home.costliest', { double: label({ segment: card.costliest, multiplier: 2 }) })}`
            : versus}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          onPress={again}
          testID="practice-again"
        >
          <Text variant="bodyStrong" tone="accent">
            {tp('home.tryAgain')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** A tiny line of recent scores. */
function Trend({
  values,
  color,
  line,
  label: a11y,
}: {
  values: number[];
  color: string;
  line: string;
  label: string;
}) {
  const W = 84;
  const H = 84;
  const pad = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (values.length - 1);
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <Svg width={W} height={H} accessible accessibilityLabel={a11y}>
      <Rect x={0} y={0} width={W} height={H} rx={10} fill={line} opacity={0.25} />
      {pts.length > 1 ? (
        <Polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Circle cx={W / 2} cy={H / 2} r={4} fill={color} />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
  },
  flex: { flex: 1, gap: theme.spacing.xxs },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  pressed: { opacity: 0.85 },
}));
