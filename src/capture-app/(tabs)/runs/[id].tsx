import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import {
  AccuracyChart,
  LabGate,
  Legend,
  pct,
  useLab,
  useSeriesColors,
} from '@/features/capture-lab/LabBits';
import {
  activateModel,
  bestEpoch,
  fetchRun,
  isLive,
  MEASURES,
  verifyModels,
  type RunDetail,
} from '@/features/capture-lab/labData';
import { LabPill } from '@/features/capture-lab/LabPill';
import { VerifyBody } from '@/features/capture-lab/VerifyBody';
import { Button, Header, Pressable, TAB_BAR_SPACE, Text } from '@/ui';

/** Ask again every 3 seconds while the run is going. */
const pollRun = (d: RunDetail) => (isLive(d.run) ? 3000 : null);

const SHORT = {
  visitCorrect: 'lab.visit',
  dartCorrect: 'lab.segment',
  boardFound: 'lab.board',
} as const;

const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return s % 60 && m < 10 ? `${m}m ${s % 60}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** One run from Lab: what it made and how it did against the model it started from, its
 * epochs, settings and log. */
export default function PastRun() {
  const { t } = useTranslation('capture');
  const { id } = useLocalSearchParams<{ id: string }>();
  const ask = useCallback((url: string) => fetchRun(url, Number(id)), [id]);
  const { labUrl, reply, reload } = useLab(ask, pollRun);
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.pad}>
        <Header
          title={t('run.title', { id })}
          backLabel={t('run.back')}
          onBack={() => router.back()}
          right={<LabPill />}
        />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <LabGate labUrl={labUrl} reply={reply} reload={reload}>
          {(d) => <RunBody d={d} labUrl={labUrl} reload={reload} />}
        </LabGate>
      </ScrollView>
    </SafeAreaView>
  );
}

function RunBody({ d, labUrl, reload }: { d: RunDetail; labUrl: string; reload: () => void }) {
  const { t } = useTranslation('capture');
  const colors = useSeriesColors();
  const [width, setWidth] = useState(0);
  const [showLog, setShowLog] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { run, metrics } = d;
  const made = d.comparison?.made ?? null;
  const base = d.comparison?.base ?? null;
  const best = bestEpoch(metrics);
  const epochs = run.params.epochs ?? metrics.length;
  const when = new Date(run.createdAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const took = run.startedAt && run.endedAt ? duration(run.endedAt - run.startedAt) : null;
  const what =
    run.kind === 'verify'
      ? (run.models ?? []).join(' vs ')
      : run.params.from === 'model' && run.baseModel
        ? t('runs.fineTune', { model: run.baseModel })
        : t('runs.scratch');
  const perEpoch = metrics.length
    ? metrics.reduce((s, m) => s + m.seconds, 0) / metrics.length
    : null;
  const throughput = metrics.at(-1)?.images_per_second;
  const lossMax = Math.max(1, ...metrics.flatMap((m) => [m.loss, m.val_loss]));
  const lossTop = Math.ceil(lossMax / 4) * 4;

  const act = async (go: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(true);
    const r = await go();
    setBusy(false);
    setNote(r.ok ? { ok: true, text: done } : { ok: false, text: r.error ?? '' });
    reload();
  };

  return (
    <>
      <View style={styles.row}>
        <View
          style={[
            styles.chip,
            run.status === 'done' && styles.chipDone,
            run.status === 'failed' && styles.chipFailed,
          ]}
        >
          <Text variant="tab">{t(`runs.status.${run.status}`)}</Text>
        </View>
        <Text variant="caption" tone="muted" style={styles.flex}>
          {[t('run.trainSub', { what, when }), took ? t('run.took', { time: took }) : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>

      {made ? (
        <View style={styles.made} testID="run-made">
          <View style={styles.row}>
            <Text variant="title" style={styles.flex}>
              {t('run.made', { name: made.name })}
            </Text>
            <Text variant="tab" tone="muted">
              {t(`models.status.${made.status}`)}
            </Text>
          </View>
          {best ? (
            <Text variant="caption" tone="muted">
              {t('run.bestAt', { epoch: best.epoch })}
            </Text>
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              {made.status === 'active' ? (
                <Text variant="caption" tone="accent">
                  {t('run.isActive', { name: made.name })}
                </Text>
              ) : (
                <Button
                  label={t('run.setActive', { name: made.name })}
                  disabled={busy}
                  onPress={() =>
                    void act(
                      () => activateModel(labUrl, made.id),
                      t('models.activated', { name: made.name }),
                    )
                  }
                  testID="run-activate"
                />
              )}
            </View>
            <View style={styles.flex}>
              <Button
                label={base ? t('run.compare', { name: base.name }) : t('run.verify')}
                disabled={busy}
                onPress={() =>
                  void act(
                    () => verifyModels(labUrl, base ? [base.id, made.id] : [made.id]),
                    t('models.queued'),
                  )
                }
                testID="run-verify"
              />
            </View>
          </View>
        </View>
      ) : run.status === 'failed' || run.status === 'cancelled' ? (
        <View style={styles.stopped} testID="run-stopped">
          <Text>
            {run.status === 'failed'
              ? t('run.failed', { error: run.error ?? '?' })
              : t('run.cancelled')}
          </Text>
        </View>
      ) : isLive(run) ? (
        <Text tone="muted">{run.status === 'queued' ? t('run.queuedNote') : t('run.going')}</Text>
      ) : null}
      {note ? (
        <Text tone={note.ok ? 'text' : 'danger'} testID="run-note">
          {note.text}
        </Text>
      ) : null}

      {run.kind === 'verify' ? <VerifyBody id={run.id} labUrl={labUrl} /> : null}

      {run.kind === 'train' && run.visitCorrect != null ? (
        <View style={styles.section} testID="run-verified">
          <View style={styles.row}>
            <Text variant="bodyStrong" style={styles.flex}>
              {t('run.verified')}
            </Text>
            {run.evaluatedOn && run.samples != null ? (
              <Text variant="caption" tone="muted">
                {t('run.verifiedOn', { where: run.evaluatedOn, count: run.samples })}
              </Text>
            ) : null}
          </View>
          <View style={styles.cells}>
            {MEASURES.map((m) => {
              const v = run[m.key];
              const ok = v != null && v >= m.bar;
              const b = base?.[m.key];
              const pts = v != null && b != null ? Math.round((v - b) * 1000) / 10 : null;
              return (
                <View key={m.key} style={styles.cell}>
                  <Text variant="caption" tone="muted">
                    {t(SHORT[m.key])}
                  </Text>
                  <Text variant="value">{pct(v)}</Text>
                  <Text variant="tab" tone={ok ? 'accent' : 'pending'}>
                    {ok
                      ? t('lab.meets', { bar: Math.round(m.bar * 100) })
                      : v != null
                        ? t('lab.toGo', {
                            pts: (Math.round((m.bar - v) * 1000) / 10).toString(),
                            bar: Math.round(m.bar * 100),
                          })
                        : ''}
                  </Text>
                  {pts != null && base ? (
                    <Text variant="tab" tone={pts > 0 ? 'accent' : pts < 0 ? 'danger' : 'muted'}>
                      {pts > 0
                        ? t('run.up', { pts: pts.toString(), name: base.name })
                        : pts < 0
                          ? t('run.down', { pts: Math.abs(pts).toString(), name: base.name })
                          : t('run.same', { name: base.name })}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          {base ? (
            <Text variant="caption" tone="muted">
              {base.sameSnapshot
                ? t('run.vsSame', { name: base.name })
                : t('run.vsLatest', { name: base.name })}
            </Text>
          ) : null}
        </View>
      ) : null}

      {metrics.length ? (
        <>
          <View style={styles.card} onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}>
            <Text variant="bodyStrong">{t('runs.chart')}</Text>
            <AccuracyChart
              width={width}
              slots={Math.max(epochs, 2)}
              floor={Math.max(
                0,
                Math.floor(
                  (Math.min(
                    ...metrics.flatMap((m) => [m.visit_correct, m.dart_correct, m.board_found]),
                  ) -
                    0.05) *
                    20,
                ) / 20,
              )}
              series={[
                { values: metrics.map((m) => m.visit_correct), color: colors.visit },
                { values: metrics.map((m) => m.dart_correct), color: colors.segment },
                { values: metrics.map((m) => m.board_found), color: colors.board },
              ]}
              labels={[
                { at: 0, text: '1' },
                { at: Math.max(epochs, 2) - 1, text: `${epochs}` },
              ]}
              marker={
                best
                  ? { at: best.epoch - 1, text: t('run.bestMark', { epoch: best.epoch }) }
                  : undefined
              }
              accessibilityLabel={t('runs.chartA11y')}
            />
            <Legend />
          </View>
          <View style={styles.card}>
            <Text variant="bodyStrong">{t('run.loss')}</Text>
            <AccuracyChart
              width={width}
              slots={Math.max(epochs, 2)}
              floor={0}
              max={lossTop}
              format={(v) => `${Math.round(v)}`}
              target={null}
              series={[
                { values: metrics.map((m) => m.loss), color: colors.visit },
                { values: metrics.map((m) => m.val_loss), color: colors.segment },
              ]}
              labels={[
                { at: 0, text: '1' },
                { at: Math.max(epochs, 2) - 1, text: `${epochs}` },
              ]}
              accessibilityLabel={t('run.lossA11y')}
            />
            <View style={styles.legend}>
              <Swatch color={colors.visit} label={t('run.train')} />
              <Swatch color={colors.segment} label={t('run.val')} />
            </View>
          </View>
          <View style={styles.cells}>
            <Stat value={took ?? '—'} label={t('run.tookLabel')} />
            <Stat
              value={perEpoch != null ? duration(perEpoch * 1000) : '—'}
              label={t('run.perEpoch')}
            />
            <Stat
              value={throughput ? t('run.imgs', { n: Math.round(throughput) }) : '—'}
              label={t('run.throughput')}
            />
          </View>
        </>
      ) : null}

      {run.kind === 'train' ? (
        <View style={styles.list}>
          <Text variant="bodyStrong" style={styles.listTitle}>
            {t('run.settings')}
          </Text>
          {(
            [
              [
                t('run.from'),
                run.params.from === 'model' ? (run.baseModel ?? '?') : t('run.scratch'),
              ],
              [
                t('run.data'),
                `${
                  run.params.captures && run.params.deepdarts
                    ? t('run.dataBoth')
                    : run.params.captures
                      ? t('run.dataOurs')
                      : t('run.dataDeepdarts')
                }${
                  run.params.deepdarts && run.params.deepdartsSample
                    ? ` ${t('run.perEpochSample', { n: run.params.deepdartsSample.toLocaleString() })}`
                    : ''
                }`,
              ],
              run.snapshot
                ? [
                    t('run.snapshot'),
                    t('run.snapshotRow', {
                      train: run.snapshot.train.toLocaleString(),
                      val: run.snapshot.val.toLocaleString(),
                      test: run.snapshot.test.toLocaleString(),
                    }),
                  ]
                : null,
              [t('run.epochs'), `${epochs}`],
              [t('run.lr'), `${run.params.lr ?? '—'}`],
              [t('run.batch'), `${run.params.batch ?? '—'}`],
              [t('run.weight'), t('run.weightValue', { n: run.params.captureWeight ?? 1 })],
            ] as const
          )
            .filter((r): r is readonly [string, string] => !!r)
            .map(([k, v]) => (
              <View key={k} style={styles.listRow}>
                <Text variant="caption" tone="muted">
                  {k}
                </Text>
                <Text variant="caption" style={styles.listValue}>
                  {v}
                </Text>
              </View>
            ))}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showLog }}
        style={styles.logHead}
        onPress={() => setShowLog(!showLog)}
        testID="run-log"
      >
        <Text variant="bodyStrong" style={styles.flex}>
          {t('run.log')}
        </Text>
        <Text variant="caption" tone="muted">
          {t('run.logLines')}
        </Text>
      </Pressable>
      {showLog ? (
        <Text variant="caption" style={styles.log} selectable>
          {d.log.tail || t('run.logEmpty')}
        </Text>
      ) : null}
      <View style={styles.end} />
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.cell}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.swatchItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  pad: { paddingHorizontal: theme.spacing.l },
  body: { gap: theme.spacing.m, padding: theme.spacing.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
  chip: {
    paddingHorizontal: theme.spacing.s,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.colors.surface2,
  },
  chipDone: { backgroundColor: theme.colors.accentSoft },
  chipFailed: { backgroundColor: theme.colors.pendingSoft },
  made: {
    gap: theme.spacing.s,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  stopped: {
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.pendingSoft,
  },
  section: { gap: theme.spacing.s },
  cells: { flexDirection: 'row', gap: theme.spacing.xs },
  cell: {
    flex: 1,
    gap: 2,
    padding: theme.spacing.s,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  card: {
    gap: theme.spacing.s,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  legend: { flexDirection: 'row', gap: theme.spacing.l },
  swatchItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  swatch: { width: 12, height: 3, borderRadius: 2 },
  list: { borderRadius: theme.radii.l, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  listTitle: {
    paddingHorizontal: theme.spacing.l,
    paddingTop: theme.spacing.m,
    paddingBottom: theme.spacing.xs,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.m,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.s,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  listValue: { flexShrink: 1, textAlign: 'right' },
  logHead: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  log: {
    padding: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface2,
    fontFamily: 'Menlo',
  },
  end: { height: TAB_BAR_SPACE },
}));
