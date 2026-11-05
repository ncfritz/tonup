import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  AccuracyChart,
  LabGate,
  Legend,
  Meter,
  pct,
  useLab,
  useSeriesColors,
} from '@/features/capture-lab/LabBits';
import { fetchOverview, MEASURES, type Overview } from '@/features/capture-lab/labData';
import { Screen, Text } from '@/ui';

const MEASURE_LABEL = {
  visitCorrect: 'lab.visitLong',
  dartCorrect: 'lab.segmentLong',
  boardFound: 'lab.boardLong',
} as const;

/** Lab's Overview on the phone: the active model against the bar, the dataset, what's thin. */
export default function CaptureOverview() {
  const { t } = useTranslation('capture');
  const { labUrl, reply, at, reload } = useLab(fetchOverview);
  return (
    <Screen scroll>
      <View>
        <Text variant="heading" accessibilityRole="header">
          {t('overview.title')}
        </Text>
        <Text tone="muted">
          {t('overview.subtitle')}
          {at
            ? ` · ${t('lab.updated', { time: at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) })}`
            : ''}
        </Text>
      </View>
      <LabGate labUrl={labUrl} reply={reply} reload={reload}>
        {(d) => <OverviewBody d={d} />}
      </LabGate>
    </Screen>
  );
}

function OverviewBody({ d }: { d: Overview }) {
  const { t } = useTranslation('capture');
  const colors = useSeriesColors();
  const [width, setWidth] = useState(0);
  const { train, val, test } = d.counts.bySplit;
  const kept = d.active ? d.prefill.find((p) => p.model === d.active!.name) : undefined;
  // The thinnest buckets across the conditions, for "what to shoot next".
  const buckets = d.coverage.flatMap((c) => {
    const total = c.buckets.reduce((n, b) => n + b.training + b.verify, 0);
    return c.buckets.map((b, i) => ({
      key: `${c.key}-${b.bucket}`,
      // Each condition's name heads its first bucket.
      group: i === 0 ? c.title : null,
      label: b.bucket,
      name: `${c.title} ${b.bucket}`,
      share: total ? (b.training + b.verify) / total : 0,
      thin: b.thin,
    }));
  });
  const thin = buckets.filter((b) => b.thin);

  return (
    <>
      <View style={styles.card} testID="overview-active">
        {d.active ? (
          <>
            <View style={styles.row}>
              <Text variant="title" style={styles.flex}>
                {t('overview.active', { name: d.active.name })}
              </Text>
              <Text variant="caption" tone="muted">
                {d.active.samples != null
                  ? t('overview.verifyPhotos', { count: d.active.samples })
                  : ''}
              </Text>
            </View>
            {MEASURES.map((m) => (
              <Meter
                key={m.key}
                label={t(MEASURE_LABEL[m.key])}
                value={d.active![m.key]}
                bar={m.bar}
              />
            ))}
            <Text variant="caption" tone="muted">
              {t('overview.meterNote')}
            </Text>
          </>
        ) : (
          <Text tone="muted">{t('overview.noActive')}</Text>
        )}
      </View>

      <View style={styles.strip}>
        <Cell n={d.counts.captures} label={t('overview.captures')} />
        <Cell n={d.counts.sessions} label={t('overview.sessions')} />
        <Cell n={d.counts.toReview} label={t('overview.toReview')} pending />
      </View>

      {train + val + test ? (
        <View style={styles.split}>
          <View style={styles.bar} accessibilityElementsHidden>
            {train ? <View style={[styles.train, { flex: train }]} /> : null}
            {val ? <View style={[styles.val, { flex: val }]} /> : null}
            {test ? <View style={[styles.test, { flex: test }]} /> : null}
          </View>
          <View style={styles.legendRow}>
            <Key style={styles.train} text={t('overview.train', { count: train })} />
            <Key style={styles.val} text={t('overview.val', { count: val })} />
            <Key style={styles.test} text={t('overview.verify', { count: test })} />
          </View>
        </View>
      ) : null}

      {d.progress.length ? (
        <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}>
          <Text variant="bodyStrong">{t('overview.progress')}</Text>
          <AccuracyChart
            width={width}
            slots={d.progress.length}
            floor={Math.max(
              0,
              Math.floor((Math.min(...d.progress.map((p) => p.visitCorrect)) - 0.05) * 10) / 10,
            )}
            series={[
              { values: d.progress.map((p) => p.visitCorrect), color: colors.visit },
              { values: d.progress.map((p) => p.dartCorrect), color: colors.segment },
              { values: d.progress.map((p) => p.boardFound), color: colors.board },
            ]}
            labels={d.progress.map((p, i) => ({ at: i, text: p.name }))}
            accessibilityLabel={t('overview.progressA11y')}
          />
          <Legend />
        </View>
      ) : null}

      {buckets.length && d.counts.captures ? (
        <View style={styles.card} testID="overview-coverage">
          <View style={styles.row}>
            <Text variant="bodyStrong" style={styles.flex}>
              {t('overview.coverage')}
            </Text>
            <Text variant="caption" tone="muted">
              {t('overview.coverageNote')}
            </Text>
          </View>
          {buckets.map((b) => (
            <View key={b.key} style={styles.bucketWrap}>
              {b.group ? (
                <Text variant="caption" tone="muted" style={styles.group}>
                  {b.group}
                </Text>
              ) : null}
              <View style={styles.bucket}>
                <Text variant="caption" style={styles.bucketLabel} numberOfLines={1}>
                  {b.label}
                </Text>
                <View style={styles.bucketTrack}>
                  <View
                    style={[
                      b.thin ? styles.thinFill : styles.okFill,
                      { width: `${b.share * 100}%` },
                    ]}
                  />
                </View>
                <Text
                  variant="caption"
                  tone={b.thin ? 'pending' : 'text'}
                  style={styles.bucketValue}
                >
                  {pct(b.share, 0)}
                </Text>
              </View>
            </View>
          ))}
          {thin.length ? (
            <Text variant="caption" tone="pending">
              {t('overview.thin', { conditions: thin.map((b) => b.name).join(', ') })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {d.active && kept?.visits ? (
        <View style={[styles.strip, styles.row]}>
          <Text variant="value">{pct(kept.accepted / kept.visits, 0)}</Text>
          <Text variant="caption" tone="muted" style={styles.flex}>
            {t('overview.prefill', { model: d.active.name, count: kept.visits })}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function Cell({ n, label, pending = false }: { n: number; label: string; pending?: boolean }) {
  return (
    <View style={styles.cell}>
      <Text variant="value" tone={pending && n ? 'pending' : 'text'}>
        {n.toLocaleString()}
      </Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function Key({ style, text }: { style: object; text: string }) {
  return (
    <View style={styles.key}>
      <View style={[styles.keySwatch, style]} />
      <Text variant="caption" tone="muted">
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.spacing.m,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
  strip: {
    flexDirection: 'row',
    gap: theme.spacing.s,
    padding: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  cell: { flex: 1 },
  split: { gap: theme.spacing.s },
  bar: { flexDirection: 'row', gap: 2, height: 10, borderRadius: 5, overflow: 'hidden' },
  train: { backgroundColor: theme.colors.accent },
  val: { backgroundColor: theme.colors.muted },
  test: { backgroundColor: theme.colors.pending },
  legendRow: { flexDirection: 'row', gap: theme.spacing.l, flexWrap: 'wrap' },
  key: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  keySwatch: { width: 10, height: 10, borderRadius: 2 },
  bucketWrap: { gap: theme.spacing.xs },
  group: { marginTop: theme.spacing.xs },
  bucket: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  bucketLabel: { width: 110 },
  bucketTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.bg,
  },
  okFill: { height: '100%', backgroundColor: theme.colors.accent },
  thinFill: { height: '100%', backgroundColor: theme.colors.pending },
  bucketValue: { width: 40, textAlign: 'right' },
}));
