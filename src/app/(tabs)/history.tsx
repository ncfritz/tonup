import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { DRILL_IDS, type DrillId } from '@/domain/drills';
import { parseRegion } from '@/domain/stats';
import { formatStat, gameName } from '@/features/game/format';
import { dayLabel } from '@/features/game/when';
import { useProOwned } from '@/features/pro/pro';
import {
  bests,
  destination,
  drillTrend,
  historyEntries,
  historyHeatmap,
  latestDrill,
  x01Trend,
  type Bests,
  type HistoryEntry,
  type HistoryFilter,
} from '@/features/history/history';
import { Board, Icon, LineChart, Pressable, Screen, SegmentedControl, Text } from '@/ui';

const HEAT_SESSIONS = 30;

/** The History tab (docs/design/screens.md → History tab). */
export default function History() {
  const { t } = useTranslation('history');
  const { t: tg } = useTranslation('game');
  const { t: tp } = useTranslation('practice');
  const { theme } = useUnistyles();
  const proOwned = useProOwned();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [drill, setDrill] = useState<DrillId | null>(null);
  const [data, setData] = useState<{
    entries: HistoryEntry[];
    trend: number[];
    bests: Bests;
    heat: ReturnType<typeof historyHeatmap>;
    now: number;
    drill: DrillId | null;
  } | null>(null);
  const [width, setWidth] = useState(0);

  const refresh = useCallback(() => {
    const d = filter === 'practice' ? (drill ?? latestDrill() ?? 'bobs27') : null;
    setData({
      entries: historyEntries(filter),
      trend: d ? drillTrend(d) : x01Trend(),
      bests: bests(),
      heat: historyHeatmap(filter, HEAT_SESSIONS),
      now: Date.now(),
      drill: d,
    });
  }, [filter, drill]);
  useFocusEffect(refresh);

  if (!data) return <Screen>{null}</Screen>;
  const { entries, trend, heat } = data;
  const trendTitle = data.drill
    ? t('trend.drill', {
        drill: tp(`drills.${data.drill}.name` as 'drills.bobs27.name'),
        count: trend.length,
      })
    : t('trend.x01', { count: trend.length });
  const latest = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  const delta = latest !== undefined && prev !== undefined ? latest - prev : null;
  const fmt = (v: number) => (data.drill ? String(v) : v.toFixed(1));

  const top = heat.regions[0];
  const topRegion = top ? regionName(top.region) : '';
  function regionName(key: string) {
    const r = parseRegion(key);
    return r ? t(`rings.${r.ring as 'treble'}`, { n: r.segment }) : '';
  }

  return (
    <Screen scroll>
      <View style={styles.titleRow}>
        <Text variant="heading" accessibilityRole="header" style={styles.flex}>
          {t('title')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={proOwned ? t('analysis.open') : t('analysis.locked')}
          accessibilityHint={t('analysis.openHint')}
          style={({ pressed }) => [styles.analysis, pressed && styles.pressed]}
          onPress={() => router.push(proOwned ? '/analysis' : '/pro')}
          testID="open-analysis"
        >
          {proOwned ? null : <Icon name="lock" color={theme.colors.muted} size={14} />}
          <Text variant="bodyStrong" tone={proOwned ? 'accent' : 'muted'}>
            {t('analysis.open')}
          </Text>
        </Pressable>
      </View>
      <SegmentedControl<HistoryFilter>
        accessibilityLabel={t('filter.label')}
        value={filter}
        onChange={setFilter}
        segments={[
          { value: 'all', label: t('filter.all') },
          { value: 'matches', label: t('filter.matches') },
          { value: 'practice', label: t('filter.practice') },
        ]}
      />

      <View
        style={styles.card}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - 32)}
      >
        <Text variant="overline" tone="muted">
          {trendTitle}
        </Text>
        {data.drill ? (
          <View style={styles.chips}>
            {DRILL_IDS.filter((id) => id === data.drill || data.bests.drills[id] !== undefined).map(
              (id) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: id === data.drill }}
                  style={[styles.chip, id === data.drill && styles.chipOn]}
                  onPress={() => setDrill(id)}
                >
                  <Text variant="caption" tone={id === data.drill ? 'onAccent' : 'text'}>
                    {tp(`drills.${id}.name` as 'drills.bobs27.name')}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        ) : null}
        {trend.length === 0 ? (
          <Text tone="muted">{data.drill ? t('trend.emptyDrill') : t('trend.empty')}</Text>
        ) : (
          <>
            <View style={styles.trendHead}>
              <Text variant="heading">{fmt(latest!)}</Text>
              {delta !== null ? (
                <Text variant="caption" tone="muted">
                  {t('trend.delta', { sign: delta >= 0 ? '+' : '−', delta: fmt(Math.abs(delta)) })}
                </Text>
              ) : null}
            </View>
            <LineChart
              values={trend}
              width={width}
              accessibilityLabel={t('trend.a11y', {
                title: trendTitle,
                latest: fmt(latest!),
                min: fmt(Math.min(...trend)),
                max: fmt(Math.max(...trend)),
              })}
            />
          </>
        )}
      </View>

      <View style={styles.bests}>
        <Best label={t('bests.bestAverage')} value={data.bests.bestAverage?.value.toFixed(1)} />
        <Best label={t('bests.highCheckout')} value={data.bests.highCheckout?.value} />
        <Best label={tp('drills.bobs27.name')} value={data.bests.drills.bobs27} />
      </View>
      {filter === 'practice' ? (
        <View style={styles.bests}>
          <Best label={tp('drills.countUp.name')} value={data.bests.drills.countUp} />
          <Best
            label={tp('drills.clock.name')}
            value={
              data.bests.drills.clock === undefined
                ? undefined
                : tp('lowerBetter', { score: data.bests.drills.clock })
            }
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text variant="overline" tone="muted">
          {t('heat.title')}
        </Text>
        {heat.total === 0 ? (
          <Text tone="muted">{t('heat.empty')}</Text>
        ) : (
          <View style={styles.heatRow}>
            <Board
              size={150}
              muted
              heat={heat.regions}
              accessibilityLabel={t('heat.a11y', { region: topRegion })}
            />
            <Text variant="caption" tone="muted" style={styles.flex}>
              {t('heat.caption', {
                sessions: Math.min(HEAT_SESSIONS, entries.length || HEAT_SESSIONS),
                darts: heat.total,
                region: topRegion,
                pct: top ? Math.round((top.count / heat.total) * 100) : 0,
                misses: Math.round((heat.misses / heat.total) * 100),
              })}
            </Text>
          </View>
        )}
      </View>

      <Text variant="overline" tone="muted">
        {t('list.title')}
      </Text>
      {entries.length === 0 ? <Text tone="muted">{t('list.empty')}</Text> : null}
      {entries.map((e) => {
        const name =
          e.kind === 'drill'
            ? tp(`drills.${e.typeId as DrillId}.name` as 'drills.bobs27.name')
            : gameName(tg, e.typeId, e.settings);
        const title = e.score ? `${name} · ${e.score}` : name;
        const sub = !e.finished
          ? t('list.inProgress')
          : [
              e.opponents.length ? t('list.vs', { names: e.opponents.join(', ') }) : t('list.solo'),
              e.stat ? `${tg(`stats.${e.stat.key}` as 'stats.mpr')} ${formatStat(e.stat)}` : null,
            ]
              .filter(Boolean)
              .join(' · ');
        const badge =
          e.kind === 'drill'
            ? null
            : e.draw
              ? t('list.drew')
              : e.won === null
                ? null
                : e.won
                  ? t('list.won')
                  : t('list.lost');
        const day = dayLabel(e.at, data.now, {
          today: tg('home.today'),
          yesterday: tg('home.yesterday'),
        });
        return (
          <Pressable
            key={e.sessionId}
            accessibilityRole="button"
            accessibilityLabel={t('list.a11y', { title, sub, day })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => {
              const to = destination(e.sessionId);
              if (to) router.push(to);
            }}
            testID={`history-${e.sessionId}`}
          >
            <View style={[styles.badge, e.won && styles.badgeWon]}>
              <Text variant="bodyStrong" tone={e.won ? 'onAccent' : 'text'}>
                {badge ?? (e.kind === 'drill' ? t('list.drillBadge') : t('list.soloBadge'))}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {sub}
              </Text>
            </View>
            <Text variant="caption" tone="muted">
              {day}
            </Text>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function Best({ label, value }: { label: string; value: string | number | undefined }) {
  const { t } = useTranslation('history');
  return (
    <View
      style={styles.best}
      accessible
      accessibilityLabel={t('bests.a11y', { label, value: value ?? t('bests.none') })}
    >
      <Text variant="overline" tone="muted" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
      <Text variant="heading" tone={value === undefined ? 'muted' : 'accent'}>
        {value ?? t('bests.none')}
      </Text>
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
  },
  trendHead: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.s },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    paddingHorizontal: theme.spacing.m,
    height: 30,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface2,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: theme.colors.accent },
  bests: { flexDirection: 'row', gap: theme.spacing.s },
  best: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
  },
  heatRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWon: { backgroundColor: theme.colors.accent },
  pressed: { opacity: 0.85 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  analysis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 40,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
  },
}));
