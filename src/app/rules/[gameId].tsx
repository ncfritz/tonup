import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { rulesEntry, useRulesT } from '@/content/rules';
import { YOU_ID } from '@/features/game/lineup';
import { useProOwned } from '@/features/pro/pro';
import { startDrill } from '@/features/game/session';
import { COUNT_UP_DEFAULTS } from '@/domain/drills';
import { CLOCK_DEFAULTS } from '@/domain/games/clock';
import { canPlayRules } from '@/domain/pro';
import { Button, Header, Screen, Section, Text } from '@/ui';

/** One game's rules, with Play for games in the app (docs/design/screens.md → Rules). */
export default function RulesPage() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const { t, list } = useRulesT();
  const { t: tg } = useTranslation('game');
  const { t: tp } = useTranslation('practice');
  const entry = rulesEntry(gameId);
  const proOwned = useProOwned();
  if (!entry) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={t('title')} backLabel={t('page.back')} onBack={() => router.back()} />
      </Screen>
    );
  }
  const key = `games.${entry.id}`;
  const name = t(`${key}.name`);
  const lines = (k: 'how' | 'scoring' | 'win' | 'variants') => list(`${key}.${k}`);
  const playable = canPlayRules(entry.id, proOwned);
  const play = () => router.push({ pathname: '/new-game', params: { game: entry.id } });
  const practise = () => {
    if (!entry.drill) return;
    const settings = entry.drill === 'countUp' ? COUNT_UP_DEFAULTS : CLOCK_DEFAULTS;
    const id = startDrill(entry.drill, settings, { id: YOU_ID, name: tg('players.you') });
    router.push({ pathname: '/drill/[sessionId]', params: { sessionId: id } });
  };
  const sections = (['how', 'scoring', 'win', 'variants'] as const).filter((k) => lines(k).length);
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t(`families.${entry.family}`)}
        backLabel={t('page.back')}
        onBack={() => router.back()}
      />
      <View>
        <Text variant="heading" accessibilityRole="header">
          {name}
        </Text>
        <Text tone="muted">{t(`${key}.summary`)}</Text>
        <Text variant="caption" tone="muted">
          {t('page.players')}: {t(`${key}.players`)}
        </Text>
      </View>
      {sections.map((k) => (
        <Section key={k} label={t(`page.${k}`)}>
          {lines(k).map((line, i) => (
            <View key={i} style={styles.bullet}>
              <Text tone="accent">•</Text>
              <Text style={styles.flex}>{line}</Text>
            </View>
          ))}
        </Section>
      ))}
      {playable ? (
        <Button label={t('page.play', { name })} onPress={play} testID="rules-play" />
      ) : (
        <View style={styles.locked}>
          <Text variant="bodyStrong">{t('page.locked')}</Text>
          <Text variant="caption" tone="muted">
            {t('page.lockedBody')}
          </Text>
          <Button
            kind="secondary"
            label={t('page.seePro')}
            onPress={() => router.push('/pro')}
            testID="see-pro"
          />
        </View>
      )}
      {entry.drill ? (
        <Button
          kind="secondary"
          label={t('page.practise', { name: tp(`drills.${entry.drill}.name`) })}
          onPress={practise}
          testID="rules-practise"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  bullet: { flexDirection: 'row', gap: theme.spacing.s },
  locked: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    gap: 2,
  },
}));
