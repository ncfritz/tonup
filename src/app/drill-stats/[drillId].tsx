import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { drills, isDrillId, type DrillId } from '@/domain/drills';
import { canUseDeepStats, canUseDrill } from '@/domain/pro';
import { VISIT_BANDS } from '@/domain/stats';
import { startPractice } from '@/features/practice/start';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import {
  CalendarCard,
  LadderCard,
  MissCard,
  SkillsCard,
  TrendCard,
  useLock,
} from '@/features/stats/components/Cards';
import { RangePicker } from '@/features/stats/components/RangePicker';
import { StatTiles } from '@/features/stats/components/StatTiles';
import { Wheel } from '@/features/stats/components/SummaryCharts';
import { loadDrillPage } from '@/features/stats/drill';
import { pct, shortDate } from '@/features/stats/format';
import { Bars, Button, CellGrid, ChartCard, Header, Ladder, RampLegend, Screen, Text } from '@/ui';

/** A drill's page (docs/design/stats.md → Per drill), opened from its row on Practice. */
export default function DrillStats() {
  const { drillId } = useLocalSearchParams<{ drillId: string }>();
  const id: DrillId = isDrillId(drillId) ? drillId : 'bobs27';
  const { t } = useTranslation('stats');
  const { t: tp } = useTranslation('practice');
  const { t: tg } = useTranslation('game');
  const tl = tp as unknown as (k: string) => string;
  const name = tl(`drills.${id}.name`);
  const range = useSettings((s) => s.statsRange);
  const setSetting = useSettings((s) => s.set);
  const saved = useSettings((s) => s.gameSettings);
  const proOwned = useProOwned();
  const [now] = useState(() => Date.now());
  const page = useMemo(() => loadDrillPage(id, range, now), [id, range, now]);
  const lock = useLock(canUseDeepStats(proOwned), () => router.push('/pro'));
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const best = page.trend.best !== null ? page.scores[page.trend.best]?.score : undefined;

  const play = () => {
    if (!canUseDrill(id, proOwned)) {
      router.push('/pro');
      return;
    }
    const settings = id === 'clock' ? (saved.clock ?? drills.clock.defaults) : drills[id].defaults;
    const sessionId = startPractice(id, tg('players.you'), settings);
    router.replace({ pathname: '/drill/[sessionId]', params: { sessionId } });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={name} backLabel={tp('title')} onBack={() => router.back()} />
      <RangePicker value={range} now={now} onChange={(r) => setSetting('statsRange', r)} />
      <StatTiles
        a11y={(label, value) => t('page.tileA11y', { label, value })}
        tiles={[
          { label: t('drill.sessions'), value: String(page.scores.length) },
          { label: t('drill.best'), value: best === undefined ? t('drill.none') : fmt(best) },
          {
            label: t('drill.average'),
            value:
              page.trend.average === null
                ? t('drill.none')
                : fmt(Math.round(page.trend.average * 10) / 10),
          },
          {
            label: t('drill.last'),
            value: page.trend.last === null ? t('drill.none') : fmt(page.trend.last),
          },
        ]}
      />
      {page.scores.length === 0 ? (
        <Text tone="muted">{t('drill.empty', { name })}</Text>
      ) : (
        <>
          <TrendCard
            title={t('drill.scores')}
            scores={page.scores}
            best={page.trend.best}
            recent={page.trend.recent}
            format={fmt}
          />
          <CalendarCard title={t('drill.calendar')} days={page.calendar} />

          {page.grid ? (
            <ChartCard
              title={t('drill.grid', { count: page.grid.rows.length })}
              locked={lock(t('drill.grid', { count: page.grid.rows.length }))}
              testID="chart-grid"
            >
              {(w) => (
                <View style={styles.gap}>
                  <CellGrid
                    width={w}
                    columns={page.grid!.columns.map((c) => c.replace(/^D/, ''))}
                    rows={page.grid!.rows.map((r) => ({ label: shortDate(r.at), cells: r.cells }))}
                    accessibilityLabel={t('drill.gridA11y', { count: page.grid!.rows.length })}
                  />
                  <Text variant="caption" tone="muted">
                    {t('drill.gridLegend')}
                  </Text>
                  <RampLegend low={t('drill.gridLow')} high={t('drill.gridHigh')} />
                </View>
              )}
            </ChartCard>
          ) : null}

          {page.ladder ? (
            <LadderCard
              title={t('drill.ladder')}
              ladder={page.ladder}
              locked={lock(t('drill.ladder'))}
            />
          ) : null}

          {page.visits ? (
            <ChartCard title={t('visits.title')} testID="chart-visits">
              {(w) => (
                <Bars
                  width={w}
                  tones={['you']}
                  groups={VISIT_BANDS.map((b) => ({
                    label: t(`visits.bands.${b.key}`),
                    values: [page.visits![b.key]],
                  }))}
                  accessibilityLabel={t('visits.a11y', { takeaway: '' })}
                />
              )}
            </ChartCard>
          ) : null}
          {page.miss ? <MissCard miss={page.miss} locked={lock(t('miss.title'))} /> : null}

          {page.wheel ? <Wheel wheel={page.wheel} /> : null}

          {page.finish ? (
            <>
              <ChartCard
                title={t('drill.finish')}
                right={
                  <Text variant="caption" tone="muted">
                    {t('drill.dartsPer')}
                  </Text>
                }
                testID="chart-finish"
              >
                {() => (
                  <Ladder
                    rows={page.finish!.bands.map((b) => ({
                      key: `${b.lo}`,
                      label: t('drill.band', { lo: b.lo, hi: b.hi }),
                      rate: b.finished / b.attempts,
                      value: `${pct(b.finished / b.attempts)}%`,
                      detail:
                        b.dartsPerFinish === null ? t('drill.none') : b.dartsPerFinish.toFixed(1),
                    }))}
                  />
                )}
              </ChartCard>
              {page.finish.missed.length ? (
                <ChartCard title={t('drill.missed')} testID="chart-missed">
                  {() => (
                    <View>
                      {page.finish!.missed.map((m) => (
                        <View
                          key={m.target}
                          style={styles.missed}
                          accessible
                          accessibilityLabel={t('drill.missedA11y', m)}
                        >
                          <Text variant="title" style={styles.flex}>
                            {String(m.target)}
                          </Text>
                          <Text variant="bodyStrong">{t('drill.missedRow', m)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ChartCard>
              ) : null}
            </>
          ) : null}

          {page.skills ? (
            <SkillsCard skills={page.skills} locked={lock(t('skills.title'))} />
          ) : null}
        </>
      )}
      <Button label={t('drill.play', { name })} onPress={play} testID="drill-play" />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  gap: { gap: theme.spacing.s },
  missed: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface2,
  },
}));
