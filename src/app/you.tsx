import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { canUseAnalysis, canUseDeepStats } from '@/domain/pro';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { CalendarCard, MissCard, SkillsCard, useLock } from '@/features/stats/components/Cards';
import { RangePicker } from '@/features/stats/components/RangePicker';
import { StatTiles } from '@/features/stats/components/StatTiles';
import { fmt1, pct, shortDate } from '@/features/stats/format';
import { loadYou } from '@/features/stats/you';
import {
  Bars,
  ChartCard,
  Header,
  Icon,
  Lines,
  niceTicks,
  NumberWheel,
  Pressable,
  Screen,
  SeriesLegend,
  Text,
  toneStyle,
} from '@/ui';

/** You (docs/design/stats.md → Overall): every game and drill over the chosen range. */
export default function You() {
  const { t } = useTranslation('stats');
  const { t: th } = useTranslation('history');
  const { t: tp } = useTranslation('practice');
  const tl = tp as unknown as (k: string) => string;
  const { theme } = useUnistyles();
  const range = useSettings((s) => s.statsRange);
  const setSetting = useSettings((s) => s.set);
  const proOwned = useProOwned();
  const [now] = useState(() => Date.now());
  const page = useMemo(() => loadYou(range, now), [range, now]);
  const deep = canUseDeepStats(proOwned);
  const lock = useLock(deep, () => router.push('/pro'));
  const h = page.headline;
  const f = page.form;

  const formTakeaway = (() => {
    if (f.averages.length < 2) return f.averages.length ? null : t('page.formEmpty');
    const parts = [
      t('page.formTakeaway', {
        from: fmt1(f.averages[0]!),
        to: fmt1(f.averages[f.averages.length - 1]!),
        count: f.averages.length,
      }),
    ];
    if (f.checkoutRate.first !== null && f.checkoutRate.last !== null) {
      parts.push(
        t('page.checkoutTakeaway', {
          first: pct(f.checkoutRate.first),
          last: pct(f.checkoutRate.last),
        }),
      );
    }
    return parts.join(' ');
  })();

  const ladder = page.doubles.ladder;
  const top = Math.max(0.01, ...ladder.map((r) => r.rate));
  const levels = Object.fromEntries(
    ladder.filter((r) => r.segment !== 25).map((r) => [r.segment, r.rate / top]),
  );
  const trusted = ladder.filter((r) => r.darts >= 6);
  const favourite = [...ladder].sort((a, b) => b.hits - a.hits)[0];
  const worst = [...trusted].sort((a, b) => a.rate - b.rate)[0];
  const dname = (s: number) => (s === 25 ? t('closing.bull') : `D${s}`);
  const overall = page.doubles.darts ? page.doubles.hits / page.doubles.darts : 0;

  const avgStyle = toneStyle(theme, 'you');
  const f9Style = toneStyle(theme, 'other');
  const formScale = niceTicks(
    Math.min(...f.averages, ...f.first9, 1000),
    Math.max(...f.averages, ...f.first9, 0),
  );

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('page.title')} backLabel={th('title')} onBack={() => router.back()} />
      <Text tone="muted">{t('page.subtitle')}</Text>
      <RangePicker value={range} now={now} onChange={(r) => setSetting('statsRange', r)} />
      <StatTiles
        columns={3}
        a11y={(label, value) => t('page.tileA11y', { label, value })}
        tiles={[
          { label: t('page.darts'), value: h.darts.toLocaleString() },
          {
            label: t('page.won'),
            value: h.games
              ? t('page.wonValue', { won: h.gamesWon, games: h.games })
              : t('drill.none'),
          },
          { label: t('page.oneEighties'), value: String(h.oneEighties) },
          {
            label: t('page.highCheckout'),
            value: h.highestCheckout ? String(h.highestCheckout) : t('drill.none'),
          },
          {
            label: t('page.bestAverage'),
            value: h.bestAverage === null ? t('drill.none') : fmt1(h.bestAverage),
          },
          { label: t('page.streak'), value: t('page.streakValue', { count: h.streak }) },
        ]}
      />

      <ChartCard
        title={t('page.form')}
        takeaway={formTakeaway}
        right={
          f.results.length ? (
            <View
              style={styles.results}
              accessible
              accessibilityLabel={t('page.resultsA11y', {
                count: f.results.length,
                list: f.results.map((w) => (w ? t('page.wonWord') : t('page.lostWord'))).join(', '),
              })}
            >
              {f.results.map((w, i) => (
                <View key={i} style={[styles.result, w && styles.resultWon]}>
                  <Text variant="caption" tone={w ? 'onAccent' : 'text'}>
                    {w ? t('page.won1') : t('page.lost1')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null
        }
        testID="chart-form"
      >
        {(w) =>
          f.averages.length > 1 ? (
            <View style={styles.gap}>
              <Lines
                width={w}
                height={150}
                series={[
                  { values: f.averages, tone: 'you' },
                  { values: f.first9, tone: 'other' },
                ]}
                {...formScale}
                format={(v) => String(Math.round(v))}
                xLabels={{ start: shortDate(f.from), end: shortDate(now) }}
                accessibilityLabel={t('page.formA11y', { takeaway: formTakeaway ?? '' })}
              />
              <SeriesLegend
                items={[
                  { label: t('page.averageLegend'), color: avgStyle.color },
                  { label: t('page.first9Legend'), color: f9Style.color, dashed: true },
                ]}
              />
            </View>
          ) : null
        }
      </ChartCard>

      <ChartCard
        title={t('page.doubles')}
        locked={lock(t('page.doubles'))}
        takeaway={ladder.length ? null : t('doubles.empty')}
        testID="chart-you-doubles"
      >
        {(w) =>
          ladder.length ? (
            <View style={styles.gap}>
              <View style={styles.center}>
                <NumberWheel
                  size={Math.min(w, 320)}
                  mode="ring"
                  levels={levels}
                  accessibilityLabel={t('page.doublesA11y', { pct: pct(overall) })}
                  center={
                    <View style={styles.center}>
                      <Text variant="heading">{`${pct(overall)}%`}</Text>
                      <Text variant="caption" tone="muted">
                        {t('page.doublesCenter', { darts: page.doubles.darts })}
                      </Text>
                    </View>
                  }
                />
              </View>
              <View style={styles.pair}>
                {favourite ? (
                  <View style={styles.pairCell}>
                    <Text variant="caption" tone="muted">
                      {t('page.favourite')}
                    </Text>
                    <Text variant="title">{`${dname(favourite.segment)} · ${pct(favourite.rate)}%`}</Text>
                  </View>
                ) : null}
                {worst ? (
                  <View style={styles.pairCell}>
                    <Text variant="caption" tone="muted">
                      {t('page.needsWork')}
                    </Text>
                    <Text variant="title">{`${dname(worst.segment)} · ${pct(worst.rate)}%`}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null
        }
      </ChartCard>

      <MissCard miss={page.miss} locked={lock(t('miss.title'))} />

      <CalendarCard title={t('page.activity')} days={page.activity.days} />
      {page.activity.weeks.some((m) => m > 0) ? (
        <ChartCard
          title={t('page.weekly')}
          takeaway={t('page.activityTakeaway', {
            current: page.activity.current,
            longest: page.activity.longest,
          })}
          testID="chart-weeks"
        >
          {(w) => (
            <Bars
              width={w}
              height={110}
              tones={['other']}
              showValues={page.activity.weeks.length <= 9}
              groups={page.activity.weeks.map((m, i) => ({ label: String(i + 1), values: [m] }))}
              accessibilityLabel={t('page.weeklyA11y', { list: page.activity.weeks.join(', ') })}
            />
          )}
        </ChartCard>
      ) : null}

      <ChartCard title={t('page.opponents')} testID="chart-opponents">
        {() =>
          page.opponents.length ? (
            <View>
              {page.opponents.map((o) => {
                const n = o.won + o.lost;
                return (
                  <View
                    key={o.key}
                    style={styles.opponent}
                    accessible
                    accessibilityLabel={t('page.opponentA11y', {
                      name: o.name,
                      won: o.won,
                      lost: o.lost,
                    })}
                  >
                    <View style={styles.oppHead}>
                      <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                        {o.name}
                      </Text>
                      <Text variant="value">{`${o.won}–${o.lost}`}</Text>
                      {o.average ? (
                        <Text variant="caption" tone="muted" style={styles.oppAvg}>
                          {t('page.averages', {
                            you: fmt1(o.average.you),
                            them: fmt1(o.average.them),
                          })}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${n ? (o.won / n) * 100 : 0}%` }]} />
                    </View>
                  </View>
                );
              })}
              {page.nextBot ? (
                <Text variant="bodyStrong" tone="accent">
                  {t('page.nextBot', {
                    pct: pct(page.nextBot.rate),
                    level: page.nextBot.level - 1,
                    next: page.nextBot.level,
                  })}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text tone="muted">{t('page.noOpponents')}</Text>
          )
        }
      </ChartCard>

      <ChartCard title={t('page.records')} testID="chart-records">
        {() =>
          page.records.length ? (
            <View>
              {page.records.map((r) => (
                <View key={`${r.key}${r.drill ?? ''}`} style={styles.record}>
                  <Text style={styles.flex} numberOfLines={1}>
                    {r.drill
                      ? tl(`drills.${r.drill}.name`)
                      : t(`page.record.${r.key as 'bestAverage'}`)}
                  </Text>
                  <Text variant="value">
                    {r.key === 'bestAverage'
                      ? fmt1(r.value)
                      : r.key === 'bestLeg'
                        ? t('page.bestLegValue', { darts: r.value })
                        : String(r.value)}
                  </Text>
                  <Text variant="caption" tone="muted" style={styles.recordDate}>
                    {shortDate(r.at)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text tone="muted">{t('page.noRecords')}</Text>
          )
        }
      </ChartCard>

      <SkillsCard skills={page.skills} locked={lock(t('skills.title'))} />

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        onPress={() => router.push(canUseAnalysis(proOwned) ? '/analysis' : '/pro')}
        testID="you-analysis"
      >
        <Text variant="bodyStrong" style={styles.flex}>
          {t('page.analysis')}
        </Text>
        {proOwned ? null : <Icon name="lock" color={theme.colors.accent} size={14} />}
        <Icon name="chevron" color={theme.colors.muted} size={16} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  gap: { gap: theme.spacing.s },
  center: { alignItems: 'center', justifyContent: 'center' },
  results: { flexDirection: 'row', gap: theme.spacing.xxs },
  result: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.line,
  },
  resultWon: { backgroundColor: theme.colors.accent },
  pair: { flexDirection: 'row', gap: theme.spacing.s },
  pairCell: {
    flex: 1,
    padding: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface2,
  },
  opponent: {
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.s,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface2,
  },
  oppHead: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.s },
  oppAvg: { minWidth: 64, textAlign: 'right' },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.colors.line, overflow: 'hidden' },
  fill: { height: 8, backgroundColor: theme.colors.accent },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    minHeight: 46,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface2,
  },
  recordDate: { width: 52, textAlign: 'right' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    minHeight: 56,
    paddingHorizontal: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.85 },
}));
