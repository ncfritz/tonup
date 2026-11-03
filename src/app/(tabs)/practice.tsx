import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { DRILL_IDS, drills, type DrillId, type Skill } from '@/domain/drills';
import { label } from '@/domain/darts';
import { canUseDrill } from '@/domain/pro';
import {
  allBests,
  lastPractice,
  suggestedDrill,
  type DrillScore,
  type PracticeCard,
} from '@/features/practice/bests';
import { LastPractice } from '@/features/practice/components/LastPractice';
import { todayPlan, type TodayPlan } from '@/features/practice/plan';
import { startPractice } from '@/features/practice/start';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { Button, Icon, Pressable, Screen, Section, Text } from '@/ui';

const SKILLS: Skill[] = ['scoring', 'accuracy', 'doubles', 'checkouts', 'assessment'];
const name = (t: (k: string) => string, id: DrillId) => t(`drills.${id}.name`);

/** The Practice tab (docs/design/screens.md → Practice tab). */
export default function Practice() {
  const { t } = useTranslation('practice');
  const { t: tg } = useTranslation('game');
  const tl = t as unknown as (k: string, o?: Record<string, unknown>) => string;
  const { theme } = useUnistyles();
  const saved = useSettings((s) => s.gameSettings);
  const proOwned = useProOwned();
  const [bests, setBests] = useState<Partial<Record<DrillId, DrillScore>>>({});
  const [suggested, setSuggested] = useState<ReturnType<typeof suggestedDrill> | null>(null);
  const [today, setToday] = useState<TodayPlan | null>(null);
  const [last, setLast] = useState<PracticeCard | null>(null);
  const [now, setNow] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setBests(allBests());
      setSuggested(suggestedDrill());
      setToday(proOwned ? todayPlan() : null);
      setLast(lastPractice());
      setNow(Date.now());
    }, [proOwned]),
  );

  const start = (id: DrillId) => {
    if (!canUseDrill(id, proOwned)) {
      router.push('/pro');
      return;
    }
    const settings = id === 'clock' ? (saved.clock ?? drills.clock.defaults) : drills[id].defaults;
    const sessionId = startPractice(id, tg('players.you'), settings);
    router.push({ pathname: '/drill/[sessionId]', params: { sessionId } });
  };

  const bestText = (id: DrillId) => {
    const b = bests[id];
    if (!b) return t('noBest');
    return drills[id].better === 'lower'
      ? t('best', { score: t('lowerBetter', { score: b.score }) })
      : t('best', { score: b.score });
  };

  const row = (id: DrillId) => {
    const open = canUseDrill(id, proOwned);
    const n = name(tl, id);
    return (
      <Pressable
        key={id}
        accessibilityRole="button"
        accessibilityLabel={open ? n : t('locked.a11y', { name: n })}
        accessibilityHint={tl(`drills.${id}.short`)}
        style={({ pressed }) => [styles.row, !open && styles.locked, pressed && styles.pressed]}
        onPress={() => start(id)}
        testID={`drill-${id}`}
      >
        <View style={styles.flex}>
          <Text variant="title" tone={open ? 'text' : 'muted'}>
            {n}
          </Text>
          <Text variant="caption" tone="muted">
            {tl(`drills.${id}.short`)}
          </Text>
        </View>
        {open ? (
          <Text variant="bodyStrong" tone={bests[id] ? 'accent' : 'muted'}>
            {bestText(id)}
          </Text>
        ) : (
          <>
            <Icon name="lock" color={theme.colors.muted} size={16} />
            <Text variant="caption" tone="muted">
              {t('locked.label')}
            </Text>
          </>
        )}
      </Pressable>
    );
  };

  return (
    <Screen scroll>
      <Text variant="heading" accessibilityRole="header">
        {t('title')}
      </Text>
      {today ? (
        <PlanCard today={today} start={start} />
      ) : suggested ? (
        <View style={styles.card}>
          <Text variant="overline" tone="accent">
            {t('suggested.title')}
          </Text>
          <Text variant="title">{name(tl, suggested.id)}</Text>
          <Text tone="muted">{t(`suggested.${suggested.reason}`)}</Text>
          <Button
            label={t('suggested.start_button')}
            onPress={() => start(suggested.id)}
            testID="start-suggested"
          />
        </View>
      ) : null}
      {last ? <LastPractice card={last} now={now} /> : null}
      {SKILLS.map((skill) => (
        <Section key={skill} label={t(`skills.${skill}`)}>
          {DRILL_IDS.filter((id) => drills[id].skill === skill).map(row)}
          {skill === 'checkouts' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                proOwned ? t('trainer.title') : t('locked.a11y', { name: t('trainer.title') })
              }
              style={({ pressed }) => [
                styles.row,
                !proOwned && styles.locked,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push(proOwned ? '/trainer' : '/pro')}
              testID="checkout-trainer"
            >
              <View style={styles.flex}>
                <Text variant="title" tone={proOwned ? 'text' : 'muted'}>
                  {t('trainer.title')}
                </Text>
                <Text variant="caption" tone="muted">
                  {t('trainer.short')}
                </Text>
              </View>
              {proOwned ? (
                <Icon name="chevron" color={theme.colors.muted} size={16} />
              ) : (
                <>
                  <Icon name="lock" color={theme.colors.muted} size={16} />
                  <Text variant="caption" tone="muted">
                    {t('locked.label')}
                  </Text>
                </>
              )}
            </Pressable>
          ) : null}
        </Section>
      ))}
    </Screen>
  );
}

/** Today's plan (Pro): the assessment when it's due, otherwise a warm-up and two drills. */
function PlanCard({ today, start }: { today: TodayPlan; start: (id: DrillId) => void }) {
  const { t } = useTranslation('practice');
  const tl = t as unknown as (k: string, o?: Record<string, unknown>) => string;
  const { theme } = useUnistyles();
  const { plan, levels, done } = today;
  const pct = (h: number, a: number) => `${Math.round((h / a) * 100)}%`;
  const dbl = (segment: number) => label({ segment, multiplier: 2 });
  const [worst, next] = plan.doubles;
  return (
    <View style={styles.card} testID="plan">
      <Text variant="overline" tone="accent">
        {t('plan.title')}
      </Text>
      {plan.due === 'first' ? (
        <>
          <Text variant="title">{t('plan.due')}</Text>
          <Text tone="muted">{t('plan.dueBody')}</Text>
          <Button
            label={t('plan.start')}
            accessibilityLabel={t('plan.assessA11y')}
            onPress={() => start('assessment')}
            testID="plan-assessment"
          />
        </>
      ) : (
        <>
          {plan.focus && plan.level !== null ? (
            <Text variant="title">{t('plan.focus', { skill: plan.focus, level: plan.level })}</Text>
          ) : null}
          {levels ? <Text tone="muted">{t('plan.levels', levels)}</Text> : null}
          {worst ? (
            <Text tone="muted" testID="plan-doubles">
              {next
                ? t('plan.doubles', {
                    worst: dbl(worst.segment),
                    worstRate: pct(worst.hits, worst.attempts),
                    next: dbl(next.segment),
                    nextRate: pct(next.hits, next.attempts),
                  })
                : t('plan.doublesOne', {
                    worst: dbl(worst.segment),
                    worstRate: pct(worst.hits, worst.attempts),
                  })}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {t('plan.minutes', { n: plan.minutes })}
          </Text>
          {[plan.warmUp, ...plan.main].map((id, i) =>
            id ? (
              <View key={`${id}-${i}`} style={styles.planRow}>
                <View style={styles.flex}>
                  <Text variant="caption" tone="muted">
                    {i === 0 ? t('plan.warmUp') : t('plan.main')}
                  </Text>
                  <Text variant="bodyStrong">{name(tl, id)}</Text>
                </View>
                {done.includes(id) ? (
                  <View style={styles.doneTag} accessible accessibilityLabel={t('plan.done')}>
                    <Icon name="check" color={theme.colors.accent} size={16} />
                    <Text variant="caption" tone="accent">
                      {t('plan.done')}
                    </Text>
                  </View>
                ) : (
                  <Button
                    kind="secondary"
                    label={t('plan.start')}
                    accessibilityLabel={t('plan.startA11y', { drill: name(tl, id) })}
                    onPress={() => start(id)}
                    testID={`plan-${id}`}
                  />
                )}
              </View>
            ) : null,
          )}
          {plan.due === 'monthly' ? (
            <View style={styles.planRow}>
              <Text tone="muted" style={styles.flex}>
                {t('plan.redue')}
              </Text>
              <Button
                kind="secondary"
                label={t('plan.assess')}
                accessibilityLabel={t('plan.assessA11y')}
                onPress={() => start('assessment')}
                testID="plan-assessment"
              />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.s,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
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
