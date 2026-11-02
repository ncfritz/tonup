import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { drills, type DrillId, type Skill } from '@/domain/drills';
import { YOU_ID } from '@/features/game/lineup';
import { startDrill } from '@/features/game/session';
import { allBests, suggestedDrill, type DrillScore } from '@/features/practice/bests';
import { useSettings } from '@/features/settings/store';
import { Button, Icon, Pressable, Screen, Section, Text } from '@/ui';

/** Pro drills, shown locked until Ton Up Pro (M10, M12), by skill. */
const PRO: Record<Skill, string[]> = {
  scoring: ['t20', 'halveIt'],
  accuracy: ['shanghai', 'bullseye'],
  doubles: ['checkouts', 'doublesLock', 'catch40', '121', 'hubbe', 'randomCheckout', '170', 'jdc'],
};
const SKILLS: Skill[] = ['scoring', 'accuracy', 'doubles'];

/** The Practice tab (docs/design/screens.md → Practice tab). */
export default function Practice() {
  const { t } = useTranslation('practice');
  const { t: tg } = useTranslation('game');
  const { theme } = useUnistyles();
  const saved = useSettings((s) => s.gameSettings);
  const [bests, setBests] = useState<Partial<Record<DrillId, DrillScore>>>({});
  const [suggested, setSuggested] = useState<ReturnType<typeof suggestedDrill> | null>(null);
  useFocusEffect(
    useCallback(() => {
      setBests(allBests());
      setSuggested(suggestedDrill());
    }, []),
  );

  const start = (id: DrillId) => {
    const settings = id === 'clock' ? (saved.clock ?? drills.clock.defaults) : drills[id].defaults;
    const sessionId = startDrill(id, settings, { id: YOU_ID, name: tg('players.you') });
    router.push({ pathname: '/drill/[sessionId]', params: { sessionId } });
  };

  const bestText = (id: DrillId) => {
    const b = bests[id];
    if (!b) return t('noBest');
    return drills[id].better === 'lower'
      ? t('best', { score: t('lowerBetter', { score: b.score }) })
      : t('best', { score: b.score });
  };

  return (
    <Screen scroll>
      <Text variant="heading" accessibilityRole="header">
        {t('title')}
      </Text>
      {suggested ? (
        <View style={styles.suggested}>
          <Text variant="overline" tone="accent">
            {t('suggested.title')}
          </Text>
          <Text variant="title">{t(`drills.${suggested.id}.name`)}</Text>
          <Text tone="muted">{t(`suggested.${suggested.reason}`)}</Text>
          <Button
            label={t('suggested.start_button')}
            onPress={() => start(suggested.id)}
            testID="start-suggested"
          />
        </View>
      ) : null}
      {SKILLS.map((skill) => (
        <Section key={skill} label={t(`skills.${skill}`)}>
          {(Object.keys(drills) as DrillId[])
            .filter((id) => drills[id].skill === skill)
            .map((id) => (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityHint={t(`drills.${id}.short`)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => start(id)}
                testID={`drill-${id}`}
              >
                <View style={styles.flex}>
                  <Text variant="title">{t(`drills.${id}.name`)}</Text>
                  <Text variant="caption" tone="muted">
                    {t(`drills.${id}.short`)}
                  </Text>
                </View>
                <Text variant="bodyStrong" tone={bests[id] ? 'accent' : 'muted'}>
                  {bestText(id)}
                </Text>
              </Pressable>
            ))}
          {PRO[skill].map((key) => {
            const name = t(`pro.${key}` as 'pro.t20');
            return (
              <View
                key={key}
                style={[styles.row, styles.locked]}
                accessible
                accessibilityLabel={t('pro.lockedA11y', { name })}
              >
                <Text variant="bodyStrong" style={styles.flex} tone="muted">
                  {name}
                </Text>
                <Icon name="lock" color={theme.colors.muted} size={16} />
                <Text variant="caption" tone="muted">
                  {t('pro.locked')}
                </Text>
              </View>
            );
          })}
        </Section>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  suggested: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.s,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    minHeight: 56,
  },
  locked: { opacity: 0.7 },
  pressed: { opacity: 0.85 },
}));
