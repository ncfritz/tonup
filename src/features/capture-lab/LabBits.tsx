// Pieces Capture's Lab tabs share: asking Lab (with its not-set and unreachable states), the
// accuracy chart, and a measure against its bar.
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Text } from '@/ui';

import type { Reply } from './labData';
import { LabPill } from './LabPill';
import { useCapture } from './store';

/** A tab's title, its line under it, and Lab's state on the right (as on every screen). */
export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.flex}>
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
      </View>
      <LabPill />
    </View>
  );
}

/**
 * Asks Lab while the tab is in view; with `every`, again on that interval (a live run, say).
 * `reload` asks again now. Pass functions defined outside the component, so they stay the same.
 */
export function useLab<T>(
  ask: (url: string) => Promise<Reply<T>>,
  every?: (data: T) => number | null,
) {
  const labUrl = useCapture((s) => s.labUrl);
  const [reply, setReply] = useState<Reply<T> | null>(null);
  const [at, setAt] = useState<Date | null>(null);
  const [asked, setAsked] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!labUrl || asked < 0) return;
      let live = true;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const go = async () => {
        const r = await ask(labUrl);
        if (!live) return;
        setReply(r);
        if (r.ok) setAt(new Date());
        const wait = r.ok ? (every?.(r.data) ?? null) : null;
        if (wait) timer = setTimeout(() => void go(), wait);
      };
      void go();
      return () => {
        live = false;
        if (timer) clearTimeout(timer);
      };
    }, [labUrl, ask, every, asked]),
  );
  return { labUrl, reply, at, reload: () => setAsked((n) => n + 1) };
}

/** The tab's content once Lab has answered; otherwise why not (no address, asking, down). */
export function LabGate<T>({
  labUrl,
  reply,
  reload,
  children,
}: {
  labUrl: string;
  reply: Reply<T> | null;
  reload: () => void;
  children: (data: T) => ReactNode;
}) {
  const { t } = useTranslation('capture');
  if (!labUrl) {
    return (
      <Text tone="muted" testID="lab-unset">
        {t('lab.unset')}
      </Text>
    );
  }
  if (!reply) {
    return (
      <Text tone="muted" testID="lab-loading">
        {t('lab.loading')}
      </Text>
    );
  }
  if (!reply.ok) {
    return (
      <View style={styles.down} testID="lab-down">
        <Text tone="danger">{t('lab.down', { error: reply.error })}</Text>
        <Button kind="secondary" label={t('lab.retry')} onPress={reload} />
      </View>
    );
  }
  return <>{children(reply.data)}</>;
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? '—' : `${(Math.round(v * 100 * 10 ** digits) / 10 ** digits).toString()}%`;

/** One measure against its bar: the number, how it stands, and a meter from 80% to 100%. */
export function Meter({ label, value, bar }: { label: string; value: number | null; bar: number }) {
  const { t } = useTranslation('capture');
  const ok = value != null && value >= bar;
  const at = (v: number) => `${Math.max(0, Math.min(1, (v - 0.8) / 0.2)) * 100}%` as const;
  styles.useVariants({ ok });
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text variant="caption" style={styles.flex}>
          {label}
        </Text>
        <Text variant="value">{pct(value)}</Text>
        <Text variant="caption" tone={ok ? 'accent' : 'pending'}>
          {ok
            ? t('lab.meets', { bar: Math.round(bar * 100) })
            : value == null
              ? ''
              : t('lab.toGo', {
                  pts: (Math.round((bar - value) * 1000) / 10).toString(),
                  bar: Math.round(bar * 100),
                })}
        </Text>
      </View>
      <View style={styles.track} accessibilityElementsHidden>
        {value != null ? <View style={[styles.fill, { width: at(value) }]} /> : null}
        <View style={[styles.tick, { left: at(bar) }]} />
      </View>
    </View>
  );
}

export interface Series {
  values: number[];
  color: string;
}

/**
 * Lines from `floor` to `max` (accuracy, 0–1, by default): one per series, a dashed line at the
 * visit bar (unless `target` is null), and labels along the bottom. `slots` spaces the x axis
 * (an epoch count, say) so lines grow as data arrives; `marker` marks one slot (the best epoch).
 */
export function AccuracyChart({
  series,
  labels,
  slots,
  width,
  floor,
  max = 1,
  format = (v: number) => `${Math.round(v * 100)}%`,
  target = 0.9,
  marker,
  accessibilityLabel,
}: {
  series: Series[];
  labels: { at: number; text: string }[];
  slots: number;
  width: number;
  floor: number;
  max?: number;
  format?: (v: number) => string;
  target?: number | null;
  marker?: { at: number; text: string };
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const { t } = useTranslation('capture');
  const height = marker ? 162 : 150;
  const left = 34;
  const right = width - 8;
  const top = 10;
  const bottom = (marker ? 150 : height) - 20;
  const x = (i: number) =>
    slots <= 1 ? (left + right) / 2 : left + (i * (right - left)) / (slots - 1);
  const y = (v: number) =>
    bottom - ((Math.min(Math.max(v, floor), max) - floor) / (max - floor)) * (bottom - top);
  const grid = [max, floor + (max - floor) / 2, floor];
  if (width <= 0) return <View style={{ height }} />;
  return (
    <Svg width={width} height={height} accessible accessibilityLabel={accessibilityLabel}>
      {grid.map((g) => (
        <Line
          key={g}
          x1={left}
          x2={right}
          y1={y(g)}
          y2={y(g)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
      ))}
      {grid.map((g) => (
        <SvgText
          key={`l${g}`}
          x={left - 6}
          y={y(g) + 4}
          fontSize={10}
          fill={theme.colors.muted}
          textAnchor="end"
        >
          {format(g)}
        </SvgText>
      ))}
      {target != null ? (
        <>
          <Line
            x1={left}
            x2={right}
            y1={y(target)}
            y2={y(target)}
            stroke={theme.colors.text}
            strokeOpacity={0.6}
            strokeDasharray="4 4"
          />
          <SvgText
            x={right}
            y={y(target) - 5}
            fontSize={10}
            fill={theme.colors.muted}
            textAnchor="end"
          >
            {t('lab.target')}
          </SvgText>
        </>
      ) : null}
      {marker ? (
        <>
          <Line
            x1={x(marker.at)}
            x2={x(marker.at)}
            y1={top}
            y2={bottom}
            stroke={theme.colors.accent}
            strokeDasharray="3 3"
          />
          <SvgText
            x={x(marker.at)}
            y={height - 2}
            fontSize={10}
            fontWeight="600"
            fill={theme.colors.accent}
            textAnchor="middle"
          >
            {marker.text}
          </SvgText>
        </>
      ) : null}
      {labels.map((l) => (
        <SvgText
          key={l.at}
          x={x(l.at)}
          y={(marker ? 150 : height) - 4}
          fontSize={10}
          fill={theme.colors.muted}
          textAnchor="middle"
        >
          {l.text}
        </SvgText>
      ))}
      {series.map((s, k) => (
        <Polyline
          key={k}
          points={s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      ))}
      {series.flatMap((s, k) =>
        s.values.map((v, i) => (
          <Circle key={`${k}-${i}`} cx={x(i)} cy={y(v)} r={3} fill={s.color} />
        )),
      )}
    </Svg>
  );
}

/** The chart's colours, by measure: the same three as Lab's charts use for visit, segment, board. */
export function useSeriesColors() {
  const { theme } = useUnistyles();
  return { visit: theme.colors.info, segment: theme.colors.pending, board: theme.colors.ok };
}

export function Legend() {
  const { t } = useTranslation('capture');
  const c = useSeriesColors();
  return (
    <View style={styles.legend}>
      {(
        [
          [c.visit, t('lab.visit')],
          [c.segment, t('lab.segment')],
          [c.board, t('lab.board')],
        ] as const
      ).map(([color, label]) => (
        <View key={label} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text variant="caption" tone="muted">
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  down: { gap: theme.spacing.s },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.s },
  flex: { flex: 1 },
  meter: { gap: theme.spacing.xs },
  meterHead: { flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.s },
  track: { height: 8, borderRadius: 4, backgroundColor: theme.colors.bg },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 4,
    variants: {
      ok: {
        true: { backgroundColor: theme.colors.accent },
        false: { backgroundColor: theme.colors.pending },
      },
    },
  },
  tick: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: theme.colors.text,
  },
  legend: { flexDirection: 'row', gap: theme.spacing.l },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  swatch: { width: 12, height: 3, borderRadius: 2 },
}));
