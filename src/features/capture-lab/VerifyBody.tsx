// A verification run on the phone (mockups › P · A verify run): the answer first (which model
// did best, and making it active), the scores side by side against their bars, how each model
// does by condition, and the photos it got most wrong. From Lab's /api/runs/:id/verification.
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { STEEL_TIP_RADII_MM as R, polar } from '@/domain/board';
import { applyHomography, CALIBRATION_IDS, fitBoard, type CalibrationId } from '@/domain/camera';
import { Button, SegmentedControl, Text } from '@/ui';

import { labPhotoUrl } from './lab';
import { pct, useLab } from './LabBits';
import {
  activateModel,
  fetchVerification,
  isLive,
  MEASURES,
  shortOn,
  verdictOf,
  type MeasureKey,
  type Verification,
  type VerifyResult,
  type VerifyWorst,
} from './labData';

type Measure = 'visit' | 'dart' | 'board';
const KEY: Record<Measure, MeasureKey> = {
  visit: 'visitCorrect',
  dart: 'dartCorrect',
  board: 'boardFound',
};
const SHORT = {
  visitCorrect: 'verify.shortVisit',
  dartCorrect: 'verify.shortSegment',
  boardFound: 'verify.shortBoard',
} as const satisfies Record<MeasureKey, string>;
/** How many of the worst photos to show. */
const WORST = 6;

export function VerifyBody({ id, labUrl }: { id: number; labUrl: string }) {
  const { t } = useTranslation('capture');
  const ask = useCallback((url: string) => fetchVerification(url, id), [id]);
  const poll = useCallback((v: Verification) => (isLive(v.run) ? 3000 : null), []);
  const { reply, reload } = useLab(ask, poll);
  if (!reply) return null;
  if (!reply.ok) return <Text tone="danger">{t('lab.down', { error: reply.error })}</Text>;
  return <Results v={reply.data} labUrl={labUrl} reload={reload} />;
}

function Results({ v, labUrl, reload }: { v: Verification; labUrl: string; reload: () => void }) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const colors = [theme.colors.info, theme.colors.accent, theme.colors.pending];
  const { results, run } = v;
  const asked = run.params.modelIds?.length ?? run.models?.length ?? results.length;
  const verdict = verdictOf(results);
  const [measure, setMeasure] = useState<Measure>('visit');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const colorOf = (modelId: number) =>
    colors[
      Math.max(
        0,
        results.findIndex((r) => r.modelId === modelId),
      ) % colors.length
    ]!;

  const activate = async (r: VerifyResult) => {
    const res = await activateModel(labUrl, r.modelId);
    setNote(
      res.ok
        ? { ok: true, text: t('models.activated', { name: r.model }) }
        : { ok: false, text: res.error },
    );
    reload();
  };

  return (
    <>
      {isLive(run) ? (
        <View style={styles.card} testID="verify-live">
          <Text>
            {run.status === 'queued'
              ? t('run.queuedNote')
              : run.stage === 'snapshot'
                ? t('verify.snapshotting')
                : t('verify.verifying', { n: Math.min(results.length + 1, asked), of: asked })}
          </Text>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${Math.round((results.length / asked) * 100)}%` }]}
            />
          </View>
        </View>
      ) : null}

      {verdict.best && !isLive(run) ? (
        <View style={styles.card} testID="verify-verdict">
          <Text variant="title">
            {verdict.next
              ? verdict.tie
                ? t('verify.tie', { a: verdict.best.model, b: verdict.next.model })
                : t('verify.beats', { a: verdict.best.model, b: verdict.next.model })
              : t('verify.one', { name: verdict.best.model })}
          </Text>
          <Text tone="muted">
            {[
              v.snapshot
                ? t('verify.onSnapshot', { count: verdict.best.samples, id: v.snapshot.id })
                : null,
              ...results.map((r) => {
                const short = shortOn(r);
                return short.length
                  ? t('verify.isShort', {
                      name: r.model,
                      what: short.map((k) => t(SHORT[k])).join(t('verify.and')),
                    })
                  : t('verify.meetsAll', { name: r.model });
              }),
            ]
              .filter(Boolean)
              .join(' ')}
          </Text>
          {verdict.promote ? (
            <Button
              label={t('run.setActive', { name: verdict.best.model })}
              onPress={() => void activate(verdict.best!)}
              testID="verify-activate"
            />
          ) : verdict.best.modelStatus === 'active' ? (
            <Text variant="caption" tone="accent">
              {t('run.isActive', { name: verdict.best.model })}
            </Text>
          ) : null}
          {note ? (
            <Text tone={note.ok ? 'text' : 'danger'} testID="verify-note">
              {note.text}
            </Text>
          ) : null}
        </View>
      ) : null}

      {results.length ? <Scores results={results} colorOf={colorOf} /> : null}

      {results.length && v.breakdown.some((b) => b.buckets.length) ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text variant="bodyStrong" style={styles.flex}>
              {t('verify.byCondition')}
            </Text>
          </View>
          <SegmentedControl<Measure>
            accessibilityLabel={t('verify.measure')}
            value={measure}
            onChange={setMeasure}
            segments={[
              { value: 'visit', label: t('lab.visit') },
              { value: 'dart', label: t('lab.segment') },
              { value: 'board', label: t('lab.board') },
            ]}
          />
          {v.breakdown
            .filter((b) => b.buckets.length)
            .map((b) => (
              <Breakdown key={b.key} b={b} results={results} measure={measure} colorOf={colorOf} />
            ))}
        </View>
      ) : null}

      {v.worst.length ? <Worst v={v} labUrl={labUrl} best={verdict.best} /> : null}

      {results.length ? (
        <View style={styles.cells}>
          <Cell value={`${results[0]!.samples}`} label={t('verify.photos')} />
          <Cell value={v.snapshot ? `${v.snapshot.id}` : '—'} label={t('verify.snapshot')} />
          <Cell
            value={`${results.reduce((n, r) => n + r.valuesOnly, 0) / results.length}`}
            label={t('verify.valuesOnly')}
          />
        </View>
      ) : null}
    </>
  );
}

/** A row per measure, a column per model (up to three), and the change when there are two. */
function Scores({
  results,
  colorOf,
}: {
  results: VerifyResult[];
  colorOf: (id: number) => string;
}) {
  const { t } = useTranslation('capture');
  const shown = results.slice(-3);
  const two = shown.length === 2;
  return (
    <View style={[styles.card, styles.flush]} testID="verify-scores">
      <View style={[styles.tableRow, styles.tableHead]}>
        <Text variant="caption" tone="muted" style={styles.measureCol}>
          {t('verify.right')}
        </Text>
        {shown.map((r) => (
          <View key={r.modelId} style={styles.numCol}>
            <View style={[styles.dot, { backgroundColor: colorOf(r.modelId) }]} />
            <Text variant="caption" tone="muted">
              {r.model}
            </Text>
          </View>
        ))}
        {two ? (
          <Text variant="caption" tone="muted" style={styles.numText}>
            {t('verify.change')}
          </Text>
        ) : null}
      </View>
      {MEASURES.map((m) => {
        const d = two ? Math.round((shown[1]![m.key] - shown[0]![m.key]) * 1000) / 10 : null;
        return (
          <View key={m.key} style={[styles.tableRow, styles.divider]}>
            <View style={styles.measureCol}>
              <Text>{t(`verify.${m.key}`)}</Text>
              <Text variant="caption" tone="muted">
                {t('verify.bar', { bar: Math.round(m.bar * 100) })}
              </Text>
            </View>
            {shown.map((r) => (
              <Text
                key={r.modelId}
                variant="value"
                tone={r[m.key] >= m.bar ? 'text' : 'pending'}
                style={styles.numText}
              >
                {pct(r[m.key])}
              </Text>
            ))}
            {d != null ? (
              <Text
                variant="caption"
                tone={d > 0 ? 'accent' : d < 0 ? 'danger' : 'muted'}
                style={styles.numText}
              >
                {d === 0 ? '=' : `${d > 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)}`}
              </Text>
            ) : null}
          </View>
        );
      })}
      <Text variant="caption" tone="muted" style={[styles.tableFoot, styles.divider]}>
        {t('verify.scoresNote')}
      </Text>
    </View>
  );
}

function Breakdown({
  b,
  results,
  measure,
  colorOf,
}: {
  b: Verification['breakdown'][number];
  results: VerifyResult[];
  measure: Measure;
  colorOf: (id: number) => string;
}) {
  const { t } = useTranslation('capture');
  const bar = MEASURES.find((m) => m.key === KEY[measure])!.bar;
  const values = b.buckets.flatMap((k) => Object.values(k.by).map((s) => s[measure]));
  // From a little under the lowest, to 100%.
  const floor = Math.max(0, Math.min(0.7, Math.floor((Math.min(...values) - 0.05) * 10) / 10));
  const at = (x: number) =>
    `${Math.max(0, Math.min(1, (x - floor) / (1 - floor))) * 100}%` as const;
  return (
    <View style={styles.card} testID={`verify-condition-${b.key}`}>
      <View style={styles.row}>
        <Text variant="bodyStrong" style={styles.flex}>
          {b.title}
        </Text>
        {b.unmeasured ? (
          <Text variant="caption" tone="muted">
            {t('verify.unmeasured', { count: Math.round(b.unmeasured) })}
          </Text>
        ) : null}
      </View>
      {b.buckets.map((k) => {
        const n = Math.max(...Object.values(k.by).map((s) => s.n));
        return (
          <View key={k.bucket} style={styles.bucket}>
            <View style={styles.bucketLabel}>
              <Text variant="caption">{k.bucket}</Text>
              <Text variant="caption" tone="muted">
                {t('verify.nPhotos', { count: n })}
              </Text>
            </View>
            <View style={styles.flex}>
              {results.map((r) => {
                const s = k.by[String(r.modelId)];
                if (!s) return null;
                return (
                  <View key={r.modelId} style={styles.barRow}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: at(s[measure]), backgroundColor: colorOf(r.modelId) },
                        ]}
                      />
                    </View>
                    <Text
                      variant="caption"
                      tone={s[measure] >= bar ? 'text' : 'pending'}
                      style={styles.barValue}
                    >
                      {pct(s[measure])}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** The photos the best model (or the one picked) got most wrong: board missed first. */
function Worst({
  v,
  labUrl,
  best,
}: {
  v: Verification;
  labUrl: string;
  best: VerifyResult | null;
}) {
  const { t } = useTranslation('capture');
  const models = v.results;
  const [pick, setPick] = useState<string>(String(best?.modelId ?? models[0]?.modelId ?? ''));
  const shown = v.worst.filter((w) => String(w.modelId) === pick).slice(0, WORST);
  const name = models.find((m) => String(m.modelId) === pick)?.model ?? '';
  return (
    <View style={styles.section} testID="verify-worst">
      <Text variant="bodyStrong">{t('verify.worst', { name })}</Text>
      {models.length > 1 ? (
        <SegmentedControl<string>
          accessibilityLabel={t('verify.worstModel')}
          value={pick}
          onChange={setPick}
          segments={models.map((m) => ({ value: String(m.modelId), label: m.model }))}
        />
      ) : null}
      {shown.length ? (
        <View style={styles.grid}>
          {shown.map((w) => (
            <WorstTile key={`${w.modelId}-${w.captureId}`} w={w} labUrl={labUrl} />
          ))}
        </View>
      ) : (
        <Text tone="muted">{t('verify.noneWrong', { name })}</Text>
      )}
      <Text variant="caption" tone="muted">
        {t('verify.worstKey', { name })}
      </Text>
    </View>
  );
}

function WorstTile({ w, labUrl }: { w: VerifyWorst; labUrl: string }) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const [size, setSize] = useState(0);
  const h = size * (w.height / w.width);
  const ring = useMemo(() => {
    const points: Partial<Record<CalibrationId, { x: number; y: number }>> = {};
    for (const id of CALIBRATION_IDS) {
      const p = w.predicted.calibration[id];
      if (p) points[id] = { x: p[0], y: p[1] };
    }
    const fit = fitBoard(points);
    if (!fit) return null;
    return Array.from({ length: 73 }, (_, i) =>
      applyHomography(fit.toImage, polar(R.doubleOuter, i * 5)),
    );
  }, [w]);
  const cap = !w.boardFound
    ? t('verify.boardMissed')
    : w.darts
      ? t('verify.dartsWrong', { wrong: w.darts - w.dartsRight, of: w.darts })
      : t('verify.totalWrong', { got: w.gotTotal ?? '—', want: w.wantTotal });
  const r = Math.max(3, size / 22);
  return (
    <View
      style={styles.tile}
      onLayout={(e) => setSize(e.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={cap}
      testID={`verify-worst-${w.captureId}`}
    >
      <View style={{ width: '100%', height: h || undefined, aspectRatio: w.width / w.height }}>
        <Image
          source={{ uri: labPhotoUrl(labUrl, w.captureId, 'thumb') }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {size > 0 ? (
          <Svg width={size} height={h} style={StyleSheet.absoluteFill}>
            {ring ? (
              <Polyline
                points={ring.map((p) => `${p.x * size},${p.y * h}`).join(' ')}
                fill="none"
                stroke={theme.colors.pending}
                strokeWidth={1.5}
                strokeDasharray="3 2"
              />
            ) : null}
            {(w.truth?.tips ?? []).map((p, i) => (
              <Circle
                key={`t${i}`}
                cx={p.x * size}
                cy={p.y * h}
                r={r}
                fill="none"
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}
            {w.predicted.tips.map(([x, y], i) => (
              <Path
                key={`p${i}`}
                d={`M${x * size - r} ${y * h - r}l${2 * r} ${2 * r}M${x * size + r} ${y * h - r}l${-2 * r} ${2 * r}`}
                stroke={theme.colors.pending}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}
          </Svg>
        ) : null}
      </View>
      <Text variant="tab" tone={w.boardFound ? 'pending' : 'danger'} style={styles.tileCap}>
        {cap}
      </Text>
    </View>
  );
}

function Cell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.cell}>
      <Text variant="value">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  section: { gap: theme.spacing.s },
  card: {
    gap: theme.spacing.s,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  flush: { padding: 0, gap: 0 },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.colors.bg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: theme.colors.accent },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    paddingHorizontal: theme.spacing.l,
    paddingVertical: theme.spacing.s,
  },
  tableHead: { paddingTop: theme.spacing.m },
  tableFoot: { paddingHorizontal: theme.spacing.l, paddingVertical: theme.spacing.s },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  measureCol: { flex: 1.4 },
  numCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  numText: { flex: 1, textAlign: 'right' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  bucket: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  bucketLabel: { width: 84 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s, minHeight: 18 },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.bg,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { width: 48, textAlign: 'right' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  tile: {
    width: '32%',
    flexGrow: 0,
    borderRadius: theme.radii.m,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  tileCap: { paddingHorizontal: theme.spacing.s, paddingVertical: 6 },
  cells: { flexDirection: 'row', gap: theme.spacing.xs },
  cell: {
    flex: 1,
    gap: 2,
    padding: theme.spacing.s,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
}));
