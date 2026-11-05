import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from '../Text';
import { mix, ramp } from './colors';

/**
 * Cricket's closing grid: numbers down, rounds across. A filled dot is the round you closed a
 * number, a ring the round an opponent did; the cells between are shaded for whoever could
 * score on it then (docs/design/stats.md → Closing grid). Two players are drawn; with more,
 * the first opponent to close counts.
 */
export function ClosingGrid({
  numbers,
  you,
  them,
  rounds,
  width,
  accessibilityLabel,
}: {
  /** Labels for the rows ("20", "Bull"). */
  numbers: string[];
  /** Round you closed each number in, or null. */
  you: (number | null)[];
  them: (number | null)[];
  rounds: number;
  width: number;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const labelW = 40;
  const gap = 3;
  const cell = Math.max(8, Math.floor((width - labelW - gap * rounds) / Math.max(1, rounds)));
  const dot = Math.min(14, cell - 4);
  const yours = mix(theme.colors.surface2, theme.colors.accent, 0.3);
  const theirs = theme.colors.line;
  const every = cell < 16 ? Math.ceil(16 / cell) : 1;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={[styles.row, { gap }]}>
        <View style={{ width: labelW }} />
        {Array.from({ length: rounds }, (_, r) => (
          <Text
            key={r}
            variant="caption"
            tone="muted"
            style={[styles.head, { width: cell }]}
            numberOfLines={1}
          >
            {r % every === 0 ? String(r + 1) : ''}
          </Text>
        ))}
      </View>
      {numbers.map((label, i) => {
        const y = you[i] ?? null;
        const s = them[i] ?? null;
        return (
          <View key={label} style={[styles.row, { gap, marginTop: 4 }]}>
            <Text variant="value" style={{ width: labelW }}>
              {label}
            </Text>
            {Array.from({ length: rounds }, (_, k) => {
              const r = k + 1;
              const youScore = y !== null && r > y && (s === null || r <= s);
              const themScore = s !== null && r > s && (y === null || r <= y);
              const bg = youScore ? yours : themScore ? theirs : theme.colors.surface2;
              return (
                <View
                  key={k}
                  style={[styles.cell, { width: cell, height: dot + 8, backgroundColor: bg }]}
                >
                  {r === y || r === s ? (
                    <View
                      style={{
                        width: dot,
                        height: dot,
                        borderRadius: dot / 2,
                        borderWidth: 2,
                        borderColor: r === y ? theme.colors.accent : theme.colors.muted,
                        backgroundColor: r === y ? theme.colors.accent : 'transparent',
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/**
 * The calendar: a cell per day, weeks across, oldest at the left. Practice days in the accent,
 * game days in muted grey, both together outlined.
 */
export function Calendar({
  days,
  width,
  accessibilityLabel,
}: {
  days: { kinds: string[] }[];
  width: number;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const weeks = Math.ceil(days.length / 7);
  const gap = 4;
  const size = Math.max(6, Math.min(22, Math.floor((width - gap * (weeks - 1)) / weeks)));
  const cols = Array.from({ length: weeks }, (_, w) => days.slice(w * 7, w * 7 + 7));
  return (
    <View
      style={[styles.calendar, { gap }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {cols.map((col, w) => (
        <View key={w} style={{ gap }}>
          {col.map((d, i) => {
            const drill = d.kinds.includes('drill');
            const game = d.kinds.includes('game');
            return (
              <View
                key={i}
                style={{
                  width: size,
                  height: size,
                  borderRadius: 4,
                  backgroundColor:
                    drill && game
                      ? ramp(theme, 0.7)
                      : drill
                        ? theme.colors.accent
                        : game
                          ? theme.colors.muted
                          : theme.colors.surface2,
                  borderWidth: drill && game ? 2 : 0,
                  borderColor: theme.colors.text,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Where misses at a treble went: the bed in the middle, high and low, the numbers either side. */
export function MissSplit({
  cells,
  accessibilityLabel,
}: {
  /** Each side's share (0–1) and label. */
  cells: Record<
    'bed' | 'high' | 'low' | 'left' | 'right' | 'other',
    { share: number; label: string }
  >;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const top = Math.max(0.01, ...Object.values(cells).map((c) => c.share));
  const tile = (key: keyof typeof cells, bed = false) => {
    const c = cells[key];
    const level = c.share / top;
    const bg = bed ? theme.colors.accent : ramp(theme, level * 0.7);
    return (
      <View
        style={[
          styles.tile,
          { backgroundColor: bg },
          bed && { borderColor: theme.colors.text, borderWidth: 2 },
        ]}
      >
        <Text variant="value" tone={bed ? 'onAccent' : 'text'}>
          {`${Math.round(c.share * 100)}%`}
        </Text>
        <Text variant="caption" tone={bed ? 'onAccent' : 'text'} numberOfLines={1}>
          {c.label}
        </Text>
      </View>
    );
  };
  return (
    <View
      style={styles.split}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.splitRow}>
        <View style={styles.blank} />
        {tile('high')}
        <View style={styles.blank} />
      </View>
      <View style={styles.splitRow}>
        {tile('left')}
        {tile('bed', true)}
        {tile('right')}
      </View>
      <View style={styles.splitRow}>
        <View style={styles.blank} />
        {tile('low')}
        {tile('other')}
      </View>
    </View>
  );
}

/**
 * Tic-Tac-Toe's grid as it ended: each square's target, who won it (filled for you, outlined
 * for the other player) and the order it was won in.
 */
export function ClaimGrid({
  cells,
  claims,
  you,
  bull,
  accessibilityLabel,
}: {
  /** Targets row by row (25 for the bull). */
  cells: number[];
  claims: { cell: number; player: number; order: number }[];
  you: number;
  bull: string;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const by = new Map(claims.map((c) => [c.cell, c]));
  return (
    <View
      style={styles.claims}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {[0, 1, 2].map((r) => (
        <View key={r} style={styles.splitRow}>
          {cells.slice(r * 3, r * 3 + 3).map((target, k) => {
            const c = by.get(r * 3 + k);
            const mine = c?.player === you;
            return (
              <View
                key={k}
                style={[
                  styles.square,
                  {
                    backgroundColor: mine ? theme.colors.accent : theme.colors.surface2,
                    borderColor: c && !mine ? theme.colors.muted : 'transparent',
                  },
                ]}
              >
                <Text variant="title" tone={mine ? 'onAccent' : c ? 'text' : 'muted'}>
                  {target === 25 ? bull : String(target)}
                </Text>
                {c ? (
                  <Text variant="caption" tone={mine ? 'onAccent' : 'muted'}>
                    {`#${c.order}`}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  claims: { gap: theme.spacing.xs, alignSelf: 'center', width: '100%', maxWidth: 300 },
  square: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: theme.radii.m,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  head: { textAlign: 'center' },
  cell: { borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  calendar: { flexDirection: 'row' },
  split: { gap: theme.spacing.xs },
  splitRow: { flexDirection: 'row', gap: theme.spacing.xs },
  tile: {
    flex: 1,
    height: 64,
    borderRadius: theme.radii.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blank: { flex: 1 },
}));
