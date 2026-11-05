import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  AccuracyChart,
  LabGate,
  Legend,
  pct,
  useLab,
  useSeriesColors,
  ScreenTitle,
} from '@/features/capture-lab/LabBits';
import {
  cancelRun,
  fetchRun,
  fetchRuns,
  fineTune,
  isLive,
  runProgress,
  type Reply,
  type RunDetail,
  type RunSummary,
} from '@/features/capture-lab/labData';
import { fetchActiveModel } from '@/features/capture-lab/lab';
import { Button, Icon, Pressable, Screen, Text } from '@/ui';

interface RunsData {
  runs: RunSummary[];
  live: RunDetail | null;
  /** The model a new run fine-tunes: Lab's active one. */
  active: { id: number; name: string } | null;
  /** When Lab answered, for the time elapsed. */
  now: number;
}

/** Lab's runs, and the one going now with its progress (it updates while it runs). */
async function askRuns(url: string): Promise<Reply<RunsData>> {
  const runs = await fetchRuns(url);
  if (!runs.ok) return runs;
  const current = runs.data.find(isLive);
  const [detail, active] = await Promise.all([
    current ? fetchRun(url, current.id) : null,
    fetchActiveModel(url),
  ]);
  return {
    ok: true,
    data: {
      runs: runs.data,
      live: detail?.ok ? detail.data : null,
      active: active.ok && active.model ? { id: active.model.id, name: active.model.name } : null,
      now: Date.now(),
    },
  };
}

/** Ask again every 3 seconds while a run is going. */
const pollRuns = (d: RunsData) => (d.live || d.runs.some(isLive) ? 3000 : null);

const minutes = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export default function CaptureRuns() {
  const { t } = useTranslation('capture');
  const { labUrl, reply, reload } = useLab(askRuns, pollRuns);
  return (
    <Screen scroll>
      <ScreenTitle title={t('runs.title')} subtitle={t('runs.subtitle')} />
      <LabGate labUrl={labUrl} reply={reply} reload={reload}>
        {(d) => <RunList d={d} labUrl={labUrl} reload={reload} />}
      </LabGate>
    </Screen>
  );
}

function useTitle() {
  const { t } = useTranslation('capture');
  return (r: RunSummary) =>
    r.kind === 'verify'
      ? t('runs.verifyTitle', { id: r.id, models: (r.models ?? []).join(' vs ') })
      : t('runs.trainTitle', {
          id: r.id,
          what:
            r.params.from === 'model' && r.baseModel
              ? t('runs.fineTune', { model: r.baseModel })
              : t('runs.scratch'),
        });
}

function RunList({ d, labUrl, reload }: { d: RunsData; labUrl: string; reload: () => void }) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const title = useTitle();
  const earlier = d.runs.filter((r) => r.id !== d.live?.run.id);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = !!d.live || d.runs.some(isLive);
  const start = (model: { id: number; name: string }) =>
    Alert.alert(t('runs.startTitle', { name: model.name }), t('runs.startBody'), [
      { text: t('runs.startCancel'), style: 'cancel' },
      {
        text: t('runs.start'),
        onPress: () =>
          void fineTune(labUrl, model.id).then((r) => {
            setNote(r.ok ? { ok: true, text: t('runs.started') } : { ok: false, text: r.error });
            reload();
          }),
      },
    ]);
  return (
    <>
      {d.active && !busy ? (
        <Button
          kind="secondary"
          label={t('runs.fineTuneButton', { model: d.active.name })}
          onPress={() => start(d.active!)}
          testID="runs-start"
        />
      ) : null}
      {note ? (
        <Text tone={note.ok ? 'text' : 'danger'} testID="runs-note">
          {note.text}
        </Text>
      ) : null}
      {!d.runs.length ? <Text tone="muted">{t('runs.none')}</Text> : null}
      {d.live ? <LiveRun d={d.live} now={d.now} labUrl={labUrl} reload={reload} /> : null}
      {earlier.length ? (
        <>
          <Text variant="overline" tone="muted">
            {t('runs.earlier')}
          </Text>
          <View style={styles.list}>
            {earlier.slice(0, 20).map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                style={[styles.runRow, i > 0 && styles.divider]}
                onPress={() => router.push(`/runs/${r.id}`)}
                testID={`run-${r.id}`}
              >
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {title(r)}
                  </Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {[
                      new Date(r.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      }),
                      r.startedAt && r.endedAt ? minutes(r.endedAt - r.startedAt) : null,
                      r.error,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <View style={styles.right}>
                  <Text
                    variant="caption"
                    tone={
                      r.status === 'done' ? 'accent' : r.status === 'failed' ? 'danger' : 'muted'
                    }
                  >
                    {t(`runs.status.${r.status}`)}
                  </Text>
                  {r.kind === 'train' && r.model ? (
                    <Text variant="caption">
                      {t('runs.made', { model: r.model, visit: pct(r.visitCorrect) })}
                    </Text>
                  ) : null}
                </View>
                <Icon name="chevron" color={theme.colors.muted} size={16} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function LiveRun({
  d,
  now,
  labUrl,
  reload,
}: {
  d: RunDetail;
  now: number;
  labUrl: string;
  reload: () => void;
}) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const title = useTitle();
  const colors = useSeriesColors();
  const [width, setWidth] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const { run, metrics, log } = d;
  const epochs = run.params.epochs ?? metrics.length;
  const progress = runProgress(d);
  const done = metrics.length;
  const perEpoch = done ? metrics.reduce((s, m) => s + m.seconds, 0) / done : null;
  const left =
    perEpoch && run.stage === 'train' ? perEpoch * 1000 * (epochs - progress * epochs) : null;
  const best = metrics.reduce<(typeof metrics)[number] | null>(
    (b, m) => (!b || m.visit_correct > b.visit_correct ? m : b),
    null,
  );
  const lowest = metrics.length
    ? Math.min(...metrics.flatMap((m) => [m.visit_correct, m.dart_correct, m.board_found]))
    : 0.75;

  const cancel = async () => {
    setCancelling(true);
    await cancelRun(labUrl, run.id);
    reload();
  };

  return (
    <View style={styles.live} testID="run-live">
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="overline" tone="accent">
            {run.status === 'queued'
              ? t('runs.queued')
              : run.kind === 'verify'
                ? t('runs.verifying')
                : t('runs.training')}
          </Text>
          <Text variant="title">{title(run)}</Text>
        </View>
        <View>
          <Button
            kind="secondary"
            label={cancelling ? t('runs.cancelled') : t('runs.cancel')}
            disabled={cancelling}
            onPress={() => void cancel()}
            testID="run-cancel"
          />
        </View>
      </View>

      {run.status === 'queued' ? (
        <Text variant="caption" tone="muted">
          {t('runs.waiting')}
        </Text>
      ) : run.kind === 'train' ? (
        <>
          <View style={styles.row}>
            <Text variant="caption" style={styles.flex}>
              {t('runs.epoch', { n: Math.min(done + 1, epochs), of: epochs })}
              {log.step && run.stage === 'train'
                ? t('runs.step', { step: log.step.step, of: log.step.of })
                : ''}
            </Text>
            <Text variant="bodyStrong">{pct(progress, 0)}</Text>
          </View>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
          >
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.strip}>
            <Stat
              value={run.startedAt ? minutes(now - run.startedAt) : '—'}
              label={t('runs.elapsed')}
            />
            <Stat value={left != null ? `~${minutes(left)}` : '—'} label={t('runs.left')} />
            <Stat
              value={best ? pct(best.visit_correct) : '—'}
              label={best ? t('runs.bestNote', { epoch: best.epoch }) : t('runs.best')}
            />
          </View>
          {metrics.length ? (
            <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              <Text variant="bodyStrong">{t('runs.chart')}</Text>
              <AccuracyChart
                width={width}
                slots={Math.max(epochs, 2)}
                floor={Math.max(0, Math.floor((lowest - 0.05) * 20) / 20)}
                series={[
                  { values: metrics.map((m) => m.visit_correct), color: colors.visit },
                  { values: metrics.map((m) => m.dart_correct), color: colors.segment },
                  { values: metrics.map((m) => m.board_found), color: colors.board },
                ]}
                labels={[
                  { at: 0, text: '1' },
                  { at: Math.max(epochs, 2) - 1, text: `${epochs}` },
                ]}
                accessibilityLabel={t('runs.chartA11y')}
              />
              <Legend />
            </View>
          ) : null}
        </>
      ) : null}
      <Pressable
        accessibilityRole="link"
        style={styles.details}
        onPress={() => router.push(`/runs/${run.id}`)}
        testID="run-live-details"
      >
        <Text variant="caption" tone="accent">
          {t('runs.details')}
        </Text>
        <Icon name="chevron" color={theme.colors.accent} size={14} />
      </Pressable>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // The run going now stands out by its fill.
  live: {
    gap: theme.spacing.m,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.accentSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1, gap: theme.spacing.xxs },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: theme.colors.bg },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.accent },
  strip: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  stat: {
    flex: 1,
    padding: theme.spacing.s,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.bg,
  },
  chart: { gap: theme.spacing.s },
  list: { borderRadius: theme.radii.l, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    padding: theme.spacing.m,
  },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  right: { alignItems: 'flex-end', gap: 2 },
  details: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    minHeight: 44,
  },
}));
