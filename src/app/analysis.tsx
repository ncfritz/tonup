import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import {
  AIM_MAP_MIN,
  ghostId,
  grouping,
  inGroup,
  nearestLevel,
  offsetGrid,
  TARGET_GROUPS,
  type AimMap,
  type Grouping,
  type OffsetGrid,
  type TargetGroup,
} from '@/domain/analysis';
import { canUseAnalysis } from '@/domain/pro';
import {
  aimMapFor,
  aimMapOffsets,
  loadAnalysis,
  TREND_WEEKS,
  type Analysis,
} from '@/features/analysis/analysis';
import { YOU_ID } from '@/features/game/lineup';
import { settingsFor } from '@/features/game/presets';
import { startGame } from '@/features/game/session';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { Board, Button, Header, LineChart, Screen, Section, SegmentedControl, Text } from '@/ui';

type T = (k: string, o?: Record<string, unknown>) => string;

/** Pro analysis (docs/design/screens.md → Analysis). */
export default function AnalysisScreen() {
  const { t: typed } = useTranslation('history');
  const t = typed as unknown as T;
  const { t: tg } = useTranslation('game');
  const proOwned = useProOwned();
  const saved = useSettings((s) => s.gameSettings);
  const data = useMemo<Analysis | null>(
    () => (canUseAnalysis(proOwned) ? loadAnalysis() : null),
    [proOwned],
  );
  const [group, setGroup] = useState<TargetGroup>('all');
  const [map, setMap] = useState<AimMap | null | undefined>(undefined);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!data) return;
    // The aim map takes a moment; draw the rest first.
    const timer = setTimeout(() => setMap(aimMapFor(data.offsets)), 50);
    return () => clearTimeout(timer);
  }, [data]);

  const offsets = useMemo(
    () => (data ? data.offsets.filter((o) => inGroup(o.target, group)) : []),
    [data, group],
  );
  const g = useMemo(() => grouping(offsets), [offsets]);
  const grid = useMemo(() => offsetGrid(offsets), [offsets]);

  if (!canUseAnalysis(proOwned)) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header
          title={t('analysis.title')}
          backLabel={t('analysis.close')}
          onBack={() => router.back()}
        />
        <Text tone="muted">{t('analysis.locked')}</Text>
        <Button label={t('analysis.open')} onPress={() => router.replace('/pro')} />
      </Screen>
    );
  }
  if (!data) return <Screen edges={['top', 'bottom']}>{null}</Screen>;

  const playGhost = () => {
    if (!data.ghost) return;
    const month = new Date(data.now).toISOString().slice(0, 7);
    const ghost = {
      id: ghostId(data.ghost.params, month),
      name: t('analysis.ghostName'),
      botLevel: nearestLevel(data.ghost.params),
    };
    const id = startGame('x01', settingsFor('x01', saved.x01), [
      { id: YOU_ID, name: tg('players.you') },
      ghost,
    ]);
    router.replace({ pathname: '/game/[sessionId]', params: { sessionId: id } });
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const weeks = [...data.weeks].reverse();
  const averages = [...data.averages].reverse();
  const series = [
    { title: t('analysis.trendAverage'), values: averages, fmt: (v: number) => v.toFixed(1) },
    { title: t('analysis.trendDoubles'), values: weeks.map((w) => w.doublesRate), fmt: pct },
    { title: t('analysis.trendTrebles'), values: weeks.map((w) => w.treblesRate), fmt: pct },
    {
      title: t('analysis.trendSigma'),
      values: weeks.map((w) => w.sigma),
      fmt: (v: number) => v.toFixed(1),
    },
  ].filter((s) => s.values.filter((v) => v !== null).length >= 2);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('analysis.title')}
        backLabel={t('analysis.close')}
        onBack={() => router.back()}
      />
      <View onLayout={onLayout} />

      <Section label={t('analysis.grouping')}>
        <SegmentedControl<TargetGroup>
          accessibilityLabel={t('analysis.groupsLabel')}
          value={group}
          onChange={setGroup}
          segments={TARGET_GROUPS.map((v) => ({ value: v, label: t(`analysis.groups.${v}`) }))}
        />
        {!g || g.n < 10 ? (
          <Text tone="muted" testID="grouping-empty">
            {t('analysis.empty')}
          </Text>
        ) : (
          <GroupingCard t={t} g={g} grid={grid} />
        )}
      </Section>

      <Section label={t('analysis.aimMap')}>
        <AimMapCard
          t={t}
          map={map}
          n={aimMapOffsets(data.offsets)?.length ?? 0}
          bull={aimMapOffsets(data.offsets)?.every((o) => inGroup(o.target, 'bull')) ?? false}
          width={width}
        />
      </Section>

      <Section label={t('analysis.trends')}>
        {series.length === 0 ? (
          <Text tone="muted">{t('analysis.trendsEmpty')}</Text>
        ) : (
          <>
            <Text variant="caption" tone="muted">
              {t('analysis.weeks', { n: TREND_WEEKS })}
            </Text>
            {series.map((s) => {
              const vals = s.values.filter((v): v is number => v !== null);
              return (
                <View key={s.title} style={styles.trend}>
                  <View style={styles.trendHead}>
                    <Text variant="bodyStrong">{s.title}</Text>
                    <Text variant="caption" tone="accent">
                      {t('analysis.now', { value: s.fmt(vals[vals.length - 1]!) })}
                    </Text>
                  </View>
                  <LineChart
                    values={vals}
                    width={width}
                    height={90}
                    accessibilityLabel={t('analysis.trendA11y', {
                      title: s.title,
                      values: vals.map(s.fmt).join(', '),
                    })}
                  />
                </View>
              );
            })}
          </>
        )}
      </Section>

      <Section label={t('analysis.ghost')}>
        <Text tone="muted">{t('analysis.ghostBody')}</Text>
        {data.ghost ? (
          <>
            <Text variant="bodyStrong" testID="ghost-line">
              {t('analysis.ghostFrom', {
                source: data.ghost.source,
                ghost: data.ghost.ghostAverage.toFixed(1),
                mine: data.ghost.average === null ? 'none' : data.ghost.average.toFixed(1),
              })}
            </Text>
            <Button label={t('analysis.ghostPlay')} onPress={playGhost} testID="play-ghost" />
          </>
        ) : (
          <Text tone="muted">{t('analysis.ghostEmpty')}</Text>
        )}
      </Section>
    </Screen>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const r0 = (v: number) => Math.round(v).toString();

function GroupingCard({ t, g, grid }: { t: T; g: Grouping; grid: OffsetGrid }) {
  const drift =
    g.drift.direction === 'none'
      ? t('analysis.noDrift')
      : t('analysis.drift', { mm: r0(g.drift.mm), direction: g.drift.direction });
  const spread = t('analysis.spread', { sigma: g.sigma.toFixed(1), r50: r0(g.r50) });
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <AimHeat grid={grid} g={g} label={t('analysis.heatA11y', { drift, spread })} />
        <View style={styles.flex}>
          <Text variant="caption" tone="muted">
            {t('analysis.darts', { n: g.n })}
          </Text>
          <Text variant="bodyStrong" testID="drift">
            {drift}
          </Text>
          <Text tone="muted" testID="spread">
            {spread}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** The aim-relative heatmap: cells shaded by count around a crosshair on the aim. */
function AimHeat({ grid, g, label }: { grid: OffsetGrid; g: Grouping; label: string }) {
  const { theme } = useUnistyles();
  const size = 150;
  const n = grid.half * 2 + 1;
  const cell = size / n;
  const mm = cell / grid.cell;
  const c = size / 2;
  return (
    <Svg width={size} height={size} accessible accessibilityLabel={label}>
      <Rect x={0} y={0} width={size} height={size} rx={8} fill={theme.colors.surface2} />
      {grid.counts.flatMap((row, r) =>
        row.map((count, col) =>
          count ? (
            <Rect
              key={`${r}-${col}`}
              x={col * cell}
              y={r * cell}
              width={cell}
              height={cell}
              fill={theme.colors.accent}
              opacity={0.15 + 0.85 * (count / grid.max)}
            />
          ) : null,
        ),
      )}
      <Line x1={c} x2={c} y1={0} y2={size} stroke={theme.colors.line} strokeWidth={1} />
      <Line x1={0} x2={size} y1={c} y2={c} stroke={theme.colors.line} strokeWidth={1} />
      <Circle
        cx={c + g.mean.x * mm}
        cy={c - g.mean.y * mm}
        r={g.r50 * mm}
        stroke={theme.colors.text}
        strokeWidth={1.5}
        fill="none"
      />
      <Circle cx={c + g.mean.x * mm} cy={c - g.mean.y * mm} r={3} fill={theme.colors.text} />
    </Svg>
  );
}

function AimMapCard({
  t,
  map,
  n,
  bull,
  width,
}: {
  t: T;
  map: AimMap | null | undefined;
  n: number;
  bull: boolean;
  width: number;
}) {
  if (map === undefined) return null;
  if (map === null) {
    return <Text tone="muted">{t('analysis.aimEmpty', { min: AIM_MAP_MIN })}</Text>;
  }
  const size = Math.min(width, 260);
  const atT20 = map.best.score - map.t20 < 0.3;
  return (
    <View style={styles.card} testID="aim-map">
      {size > 0 ? (
        <View style={styles.center}>
          <Board
            size={size}
            muted
            markers={[{ point: map.best.point, text: '★' }]}
            accessibilityLabel={t('analysis.aimA11y')}
          />
        </View>
      ) : null}
      <Text variant="bodyStrong">
        {atT20 ? t('analysis.aimT20') : t('analysis.aimBest', { best: map.best.score.toFixed(1) })}
      </Text>
      <Text tone="muted">
        {t('analysis.aimCompare', { t20: map.t20.toFixed(1), bull: map.bull.toFixed(1) })}
      </Text>
      <Text variant="caption" tone="muted">
        {t('analysis.aimFrom', { n, bull: bull ? 'yes' : 'no', sigma: map.sigma })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1, gap: theme.spacing.xs },
  row: { flexDirection: 'row', gap: theme.spacing.m, alignItems: 'center' },
  center: { alignItems: 'center' },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.m,
    gap: theme.spacing.s,
  },
  trend: { gap: theme.spacing.xs },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between' },
}));
