import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '../Text';
import { mix, ramp } from './colors';

/**
 * A ladder: a row per item, best first, with a bar for its rate (the double ladder, finish
 * rate by score band).
 */
export function Ladder({
  rows,
}: {
  rows: { key: string; label: string; rate: number; value: string; detail?: string }[];
}) {
  const { theme } = useUnistyles();
  const top = Math.max(0.01, ...rows.map((r) => r.rate));
  return (
    <View style={styles.ladder}>
      {rows.map((r) => (
        <View
          key={r.key}
          style={styles.ladderRow}
          accessible
          accessibilityLabel={[r.label, r.value, r.detail].filter(Boolean).join(', ')}
        >
          <Text variant="value" style={styles.ladderLabel} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.round((r.rate / top) * 100)}%`,
                  backgroundColor:
                    r.rate >= top * 0.6
                      ? theme.colors.accent
                      : mix(theme.colors.muted, theme.colors.line, 0.25),
                },
              ]}
            />
          </View>
          <Text variant="bodyStrong" style={styles.ladderValue}>
            {r.value}
          </Text>
          {r.detail ? (
            <Text variant="caption" tone="muted" style={styles.ladderDetail}>
              {r.detail}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * A grid of shaded cells: drill steps across and sessions down (the session grid), or numbers
 * down and rounds across. Levels are 0–1; null is empty.
 */
export function CellGrid({
  columns,
  rows,
  width,
  accessibilityLabel,
}: {
  columns: string[];
  rows: { label: string; cells: (number | null)[] }[];
  width: number;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const labelW = 34;
  const gap = 2;
  const cell = Math.max(8, Math.floor((width - labelW - gap * columns.length) / columns.length));
  const every = cell < 14 ? Math.ceil(14 / cell) : 1;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.gridRow, { gap }]}>
        <View style={{ width: labelW }} />
        {columns.map((c, i) => (
          <Text
            key={i}
            variant="caption"
            tone="muted"
            style={[styles.colLabel, { width: cell }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {i % every === 0 ? c : ''}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[styles.gridRow, { gap, marginTop: gap }]}>
          <Text variant="caption" tone="muted" style={{ width: labelW }} numberOfLines={1}>
            {r.label}
          </Text>
          {r.cells.map((v, i) => (
            <View
              key={i}
              style={{
                width: cell,
                height: Math.min(18, cell + 4),
                borderRadius: 3,
                backgroundColor: v === null ? theme.colors.surface2 : ramp(theme, v),
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/** A small legend for a ramp: the empty colour to the accent, with words at each end. */
export function RampLegend({ low, high }: { low: string; high: string }) {
  const { theme } = useUnistyles();
  return (
    <View style={styles.legend} importantForAccessibility="no-hide-descendants">
      <Text variant="caption" tone="muted">
        {low}
      </Text>
      {[0, 0.25, 0.5, 0.75, 1].map((l) => (
        <View key={l} style={[styles.swatch, { backgroundColor: ramp(theme, l) }]} />
      ))}
      <Text variant="caption" tone="muted">
        {high}
      </Text>
    </View>
  );
}

/** A legend for line or bar series. */
export function SeriesLegend({
  items,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <View style={styles.legend} importantForAccessibility="no-hide-descendants">
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View
            style={[
              styles.key,
              it.dashed
                ? { borderTopWidth: 3, borderStyle: 'dashed', borderColor: it.color }
                : { backgroundColor: it.color, height: 3 },
            ]}
          />
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A score table: rounds across, players down, a total at the end (Golf, Baseball). */
export function RoundTable({
  columns,
  rows,
  highlight,
}: {
  columns: string[];
  rows: { name: string; you: boolean; cells: (number | null)[]; total: string }[];
  /** Which cells to pick out: [row, column]. */
  highlight?: [number, number][];
}) {
  const { theme } = useUnistyles();
  const lit = new Set((highlight ?? []).map(([r, c]) => `${r}:${c}`));
  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <View style={styles.tableName} />
        {columns.map((c, i) => (
          <Text key={i} variant="caption" tone="muted" style={styles.tableCell}>
            {c}
          </Text>
        ))}
        <View style={styles.tableTotal} />
      </View>
      {rows.map((r, ri) => (
        <View
          key={ri}
          style={styles.tableRow}
          accessible
          accessibilityLabel={`${r.name}: ${r.cells.map((v) => v ?? '–').join(', ')}; ${r.total}`}
        >
          <Text
            variant="bodyStrong"
            tone={r.you ? 'accent' : 'muted'}
            style={styles.tableName}
            numberOfLines={1}
          >
            {r.name}
          </Text>
          {r.cells.map((v, i) => {
            const on = lit.has(`${ri}:${i}`);
            return (
              <View
                key={i}
                style={[
                  styles.tableCell,
                  styles.tableBox,
                  { backgroundColor: on ? theme.colors.accent : theme.colors.surface2 },
                ]}
              >
                <Text
                  variant="caption"
                  tone={on ? 'onAccent' : r.you ? 'text' : 'muted'}
                  numberOfLines={1}
                >
                  {v === null ? '' : String(v)}
                </Text>
              </View>
            );
          })}
          <Text variant="bodyStrong" style={styles.tableTotal} numberOfLines={1}>
            {r.total}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  ladder: { gap: theme.spacing.xs },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s, minHeight: 30 },
  ladderLabel: { width: 52 },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.surface2,
    overflow: 'hidden',
  },
  fill: { height: 12, borderRadius: 6 },
  ladderValue: { width: 46, textAlign: 'right' },
  ladderDetail: { width: 44, textAlign: 'right' },
  gridRow: { flexDirection: 'row', alignItems: 'center' },
  colLabel: { textAlign: 'center', fontSize: 10 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.s },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  key: { width: 16 },
  swatch: { width: 20, height: 10, borderRadius: 2 },
  table: { gap: theme.spacing.xs },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tableName: { width: 56 },
  tableCell: { flex: 1, textAlign: 'center' },
  tableBox: { height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  tableTotal: { width: 36, textAlign: 'right' },
}));
