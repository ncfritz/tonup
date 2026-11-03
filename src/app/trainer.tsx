import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  explainRoute,
  trainerDeck,
  trainerRoute,
  type RouteNote,
  type TrainerRange,
} from '@/domain/drills';
import { label } from '@/domain/darts';
import { startPractice } from '@/features/practice/start';
import { useProOwned } from '@/features/pro/pro';
import { Button, Header, Screen, Section, SegmentedControl, Text } from '@/ui';

/**
 * The checkout trainer (Pro; docs/design/screens.md → Checkout trainer): flashcards of finishes
 * with the route and why it's the route, cards you didn't know coming back once at the end, then
 * the same finishes on the board as a Random Checkout.
 */
export default function Trainer() {
  const { t } = useTranslation('practice');
  const { t: tg } = useTranslation('game');
  const tl = t as unknown as (k: string, o?: Record<string, unknown>) => string;
  const proOwned = useProOwned();
  const [range, setRange] = useState<TrainerRange>('mid');
  const [deck, setDeck] = useState<number[]>(() => trainerDeck('mid', Math.random));
  const [queue, setQueue] = useState<number[]>(deck);
  const [pos, setPos] = useState(0);
  const [shown, setShown] = useState(false);
  /** First-time answers by score. */
  const [first, setFirst] = useState<Record<number, boolean>>({});

  const deal = (r: TrainerRange) => {
    const d = trainerDeck(r, Math.random);
    setRange(r);
    setDeck(d);
    setQueue(d);
    setPos(0);
    setShown(false);
    setFirst({});
  };

  const answer = (knew: boolean) => {
    const score = queue[pos]!;
    const seen = score in first;
    if (!seen) setFirst((f) => ({ ...f, [score]: knew }));
    // A card you didn't know comes back once at the end.
    if (!knew && !seen) setQueue((q) => [...q, score]);
    setPos((p) => p + 1);
    setShown(false);
  };

  const onBoard = () => {
    const id = startPractice(
      'randomCheckout',
      tg('players.you'),
      { targets: deck },
      { deal: false },
    );
    router.replace({ pathname: '/drill/[sessionId]', params: { sessionId: id } });
  };

  if (!proOwned) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header
          title={t('trainer.title')}
          backLabel={t('trainer.close')}
          onBack={() => router.back()}
        />
        <Text tone="muted">{t('locked.a11y', { name: t('trainer.title') })}</Text>
        <Button label={t('locked.label')} onPress={() => router.replace('/pro')} />
      </Screen>
    );
  }

  const score = queue[pos];
  const route = score === undefined ? null : trainerRoute(score);
  const right = Object.values(first).filter(Boolean).length;

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('trainer.title')}
        backLabel={t('trainer.close')}
        onBack={() => router.back()}
      />
      <Section label={t('trainer.range')}>
        <SegmentedControl<TrainerRange>
          accessibilityLabel={t('trainer.range')}
          value={range}
          onChange={deal}
          segments={[
            { value: 'low', label: t('trainer.low') },
            { value: 'mid', label: t('trainer.mid') },
            { value: 'high', label: t('trainer.high') },
          ]}
        />
      </Section>
      {score === undefined ? (
        <View style={styles.card} testID="trainer-done">
          <Text variant="title">{t('trainer.done', { right, of: deck.length })}</Text>
          <Button label={t('trainer.board')} onPress={onBoard} testID="trainer-board" />
          <Button kind="secondary" label={t('trainer.restart')} onPress={() => deal(range)} />
          <Button kind="secondary" label={t('trainer.close')} onPress={() => router.back()} />
        </View>
      ) : (
        <View style={styles.card}>
          <Text variant="overline" tone="muted">
            {t('trainer.card', { n: Math.min(pos + 1, queue.length), of: queue.length })}
          </Text>
          <Text variant="caption" tone="muted">
            {t('trainer.finish', { score })}
          </Text>
          <Text variant="score" tone="accent" testID="trainer-score">
            {score}
          </Text>
          {shown && route ? (
            <>
              <Text
                variant="title"
                accessibilityLabel={t('trainer.routeA11y', { route: route.map(label).join(', ') })}
                testID="trainer-route"
              >
                {route.map(label).join(' · ')}
              </Text>
              {explainRoute(score, route).map((n, i) => (
                <Text key={i} tone="muted">
                  {why(tl, n)}
                </Text>
              ))}
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    label={t('trainer.knew')}
                    onPress={() => answer(true)}
                    testID="trainer-knew"
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    kind="secondary"
                    label={t('trainer.missed')}
                    accessibilityHint={score in first ? undefined : t('trainer.again')}
                    onPress={() => answer(false)}
                    testID="trainer-missed"
                  />
                </View>
              </View>
            </>
          ) : (
            <Button
              label={t('trainer.show')}
              onPress={() => setShown(true)}
              testID="trainer-show"
            />
          )}
        </View>
      )}
    </Screen>
  );
}

function why(t: (k: string, o?: Record<string, unknown>) => string, n: RouteNote): string {
  switch (n.kind) {
    case 'one':
      return t('trainer.why.one', { double: n.double });
    case 'bull':
      return t('trainer.why.bull');
    case 'leaves':
      return t('trainer.why.leaves', n);
    case 'single':
      return t('trainer.why.single', { ...n, ok: n.ok ? 'yes' : 'no' });
    case 'split':
      return t('trainer.why.split', n);
  }
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.s,
    alignItems: 'stretch',
  },
  row: { flexDirection: 'row', gap: theme.spacing.s },
}));
