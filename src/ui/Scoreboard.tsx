import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { label } from '@/domain/darts';
import type { CricketDetail, GridDetail, ScoreboardRow, ScoreboardView } from '@/domain/games';

import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * The broadcast-style scoreboard (docs/design/screens.md → Scoring): one row per player with
 * legs (and sets) and the score, the player at the oche marked with the accent bar, and the
 * strip below: the checkout route, Bust, Game shot or No finish.
 */
export interface RowFormat {
  /** The big number or word on the right. */
  big: string;
  /** A short line under the name. */
  note?: string;
  a11y: string;
}

export function Scoreboard({
  view,
  showLegs = true,
  showSets,
  format,
}: {
  view: ScoreboardView;
  showLegs?: boolean;
  showSets: boolean;
  /** How a row reads in this game; X01's remaining score by default. */
  format?: (row: ScoreboardRow) => RowFormat;
}) {
  const { t } = useTranslation('game');
  const compact = view.rows.length > 3;
  const strip = stripText(view, t as unknown as T);
  const fmt =
    format ??
    ((r: ScoreboardRow): RowFormat => ({
      big: String(r.score),
      a11y: t('scoreboard.rowA11y', {
        name: r.name,
        score: r.score,
        legs: r.legs,
        sets: r.sets,
        showSets: showSets ? 'yes' : 'no',
      }),
    }));
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {view.detail?.kind === 'cricket' ? <CricketGrid view={view} detail={view.detail} /> : null}
      {view.detail?.kind === 'grid' ? <SquareGrid view={view} detail={view.detail} /> : null}
      {view.detail?.kind === 'cricket'
        ? null
        : view.rows.map((r) => {
            const f = fmt(r);
            return (
              <View
                key={r.playerId}
                style={[
                  styles.row,
                  r.active && styles.rowActive,
                  compact && styles.rowCompact,
                  r.out && styles.rowOut,
                ]}
                accessible
                accessibilityLabel={f.a11y}
                accessibilityState={{ selected: r.active }}
              >
                <View style={[styles.bar, r.active && styles.barActive]} />
                <View style={styles.name}>
                  <Text
                    variant="title"
                    tone={r.active ? 'text' : 'muted'}
                    style={styles.upper}
                    numberOfLines={1}
                  >
                    {r.name}
                  </Text>
                  {f.note ? (
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {f.note}
                    </Text>
                  ) : null}
                </View>
                {showSets ? (
                  <Text variant="value" tone="accent" style={styles.count}>
                    {r.sets}
                  </Text>
                ) : null}
                {showLegs ? (
                  <Text variant="value" tone="accent" style={styles.count}>
                    {r.legs}
                  </Text>
                ) : null}
                <Text
                  variant="score"
                  tone={r.active ? 'text' : 'muted'}
                  style={[
                    styles.score,
                    !r.active && styles.scoreIdle,
                    compact && styles.scoreCompact,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {f.big}
                </Text>
              </View>
            );
          })}
      <View
        style={[styles.strip, strip.danger && styles.stripDanger]}
        accessibilityLiveRegion="polite"
        testID="checkout-strip"
      >
        <Text variant="overline" tone={strip.danger ? 'onDanger' : 'text'}>
          {strip.left}
        </Text>
        <Text variant="value" tone={strip.danger ? 'onDanger' : 'accent'}>
          {strip.right}
        </Text>
      </View>
    </View>
  );
}

/** Loosely typed: the strip builds keys from the status (fully typed keys get too deep here). */
type T = (key: string, options?: Record<string, unknown>) => string;

function stripText(view: ScoreboardView, t: T): { left: string; right: string; danger: boolean } {
  const s = view.status;
  const active = view.rows.find((r) => r.active);
  switch (s.kind) {
    case 'checkout':
      return {
        left: t('strip.require', { score: active?.score ?? 0 }),
        right: s.route.map(label).join(' · '),
        danger: true,
      };
    case 'bust':
      return { left: t('strip.bust'), right: '', danger: true };
    case 'legWon':
    case 'matchWon':
      return { left: t('strip.gameShot'), right: nameOf(view, s.playerId), danger: true };
    case 'notOpened':
      return { left: t('strip.doubleToStart'), right: '', danger: false };
    case 'noFinish':
      return { left: t('strip.noFinish', { score: active?.score ?? 0 }), right: '', danger: false };
    case 'aim':
      return {
        left: t(`strip.aim.${s.reason}`),
        // Segment 0 stands for "any": Halve-It's any double or treble.
        right:
          s.target.segment === 0
            ? t(s.target.multiplier === 3 ? 'strip.anyTreble' : 'strip.anyDouble')
            : label(s.target),
        danger: false,
      };
    default:
      return { left: '', right: '', danger: false };
  }
}

/** One mark, two, or closed: "/", "X", "Ⓧ". */
const MARKS = ['', '/', '✕', 'Ⓧ'];

/** Cricket: a row per number and a column per player, points underneath. */
function CricketGrid({ view, detail }: { view: ScoreboardView; detail: CricketDetail }) {
  const { t } = useTranslation('game');
  return (
    <View style={styles.grid}>
      <View style={styles.gridRow}>
        <View style={styles.gridNumber} />
        {view.rows.map((r) => (
          <View key={r.playerId} style={[styles.gridCell, r.active && styles.gridActive]}>
            <Text
              variant="bodyStrong"
              tone={r.active ? 'text' : 'muted'}
              numberOfLines={1}
              style={styles.upper}
            >
              {r.name}
            </Text>
          </View>
        ))}
      </View>
      {detail.numbers.map((n, i) => (
        <View key={n} style={[styles.gridRow, detail.dead[i] && styles.dead]}>
          <View style={styles.gridNumber}>
            <Text variant="value" tone="accent">
              {numberLabel(n, t as unknown as T)}
            </Text>
          </View>
          {view.rows.map((r, p) => (
            <View
              key={r.playerId}
              style={[styles.gridCell, r.active && styles.gridActive]}
              accessible
              accessibilityLabel={t('cricket.marksA11y', {
                name: r.name,
                number: numberLabel(n, t as unknown as T, true),
                marks: detail.marks[p]![i]!,
              })}
            >
              <Text variant="title">{MARKS[detail.marks[p]![i]!]}</Text>
            </View>
          ))}
        </View>
      ))}
      {detail.points === false ? null : (
        <View style={styles.gridRow}>
          <View style={styles.gridNumber}>
            <Text variant="caption" tone="muted">
              {t('cricket.points')}
            </Text>
          </View>
          {view.rows.map((r) => (
            <View key={r.playerId} style={[styles.gridCell, r.active && styles.gridActive]}>
              <Text variant="value">{r.score}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** A cricket number: 20…, Bull, and Mickey Mouse's any double (-2) and any treble (-3). */
function numberLabel(n: number, t: T, long = false): string {
  if (n === 25) return t('cricket.bull');
  if (n === -2) return t(long ? 'strip.anyDouble' : 'cricket.anyDouble');
  if (n === -3) return t(long ? 'strip.anyTreble' : 'cricket.anyTreble');
  return String(n);
}

/** Tic-Tac-Toe's three-by-three board: each square's number, and the mark of who claimed it. */
function SquareGrid({ view, detail }: { view: ScoreboardView; detail: GridDetail }) {
  const { t } = useTranslation('game');
  const marks = ['✕', '○'];
  const rows = [0, 1, 2].map((r) => detail.cells.slice(r * 3, r * 3 + 3));
  return (
    <View style={styles.squares}>
      {rows.map((cells, r) => (
        <View key={r} style={styles.squareRow}>
          {cells.map((n, c) => {
            const i = r * 3 + c;
            const owner = detail.owner[i];
            const number = numberLabel(n, t as unknown as T);
            return (
              <View
                key={i}
                style={[styles.square, owner != null && styles.squareTaken]}
                accessible
                accessibilityLabel={
                  owner == null
                    ? t('ticTacToe.openA11y', { number })
                    : t('ticTacToe.takenA11y', { number, name: view.rows[owner]?.name ?? '' })
                }
              >
                <Text variant="caption" tone="muted">
                  {number}
                </Text>
                <Text variant="title" tone={owner == null ? 'muted' : 'accent'}>
                  {owner == null ? '' : marks[owner]}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const nameOf = (view: ScoreboardView, id: string) =>
  view.rows.find((r) => r.playerId === id)?.name ?? '';

/** The three darts of the visit and its total; a tap on a dart edits it. */
export function DartSlots({
  darts,
  total,
  bust,
  onPressDart,
}: {
  darts: string[];
  total: number;
  bust: boolean;
  onPressDart?: (index: number) => void;
}) {
  const { t } = useTranslation('game');
  return (
    <View style={styles.slots}>
      {[0, 1, 2].map((i) => {
        const text = darts[i];
        return (
          <Pressable
            key={i}
            disabled={!text || !onPressDart}
            accessibilityRole="button"
            accessibilityLabel={
              text
                ? t('slots.dartA11y', { n: i + 1, dart: text })
                : t('slots.emptyA11y', { n: i + 1 })
            }
            accessibilityHint={text && onPressDart ? t('slots.editHint') : undefined}
            style={[styles.slot, text ? styles.slotFilled : null]}
            onPress={() => onPressDart?.(i)}
            testID={`slot-${i}`}
          >
            <Text variant="title">{text ?? ''}</Text>
          </Pressable>
        );
      })}
      <View style={[styles.total, bust && styles.totalBust]} testID="visit-total">
        <Text variant="title" tone={bust ? 'onDanger' : 'onAccent'}>
          {bust ? t('slots.bust') : total}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { borderRadius: theme.radii.m, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bg,
  },
  rowActive: { minHeight: 56, backgroundColor: theme.colors.surface2 },
  rowCompact: { minHeight: 40 },
  bar: { width: 10, alignSelf: 'stretch' },
  barActive: { backgroundColor: theme.colors.accent },
  name: { flex: 1, paddingLeft: theme.spacing.s },
  upper: { textTransform: 'uppercase' },
  rowOut: { opacity: 0.45 },
  grid: { backgroundColor: theme.colors.surface },
  gridRow: { flexDirection: 'row', alignItems: 'center', minHeight: 30 },
  gridNumber: { width: 56, alignItems: 'center' },
  gridCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 2,
  },
  gridActive: { backgroundColor: theme.colors.surface2 },
  dead: { opacity: 0.35 },
  squares: { backgroundColor: theme.colors.surface, padding: theme.spacing.xs, gap: 4 },
  squareRow: { flexDirection: 'row', gap: 4 },
  square: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.bg,
  },
  squareTaken: { backgroundColor: theme.colors.surface2 },
  count: { width: 36, textAlign: 'center' },
  score: {
    width: 104,
    textAlign: 'right',
    paddingRight: theme.spacing.m,
    fontSize: 40,
    lineHeight: 44,
  },
  scoreIdle: { fontSize: 32, lineHeight: 36 },
  scoreCompact: { fontSize: 26, lineHeight: 30 },
  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
  stripDanger: { backgroundColor: theme.colors.danger },
  slots: { flexDirection: 'row', gap: 6 },
  slot: {
    flex: 1,
    height: 44,
    borderRadius: theme.radii.s,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: { backgroundColor: theme.colors.surface2, borderColor: theme.colors.surface2 },
  total: {
    width: 72,
    height: 44,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBust: { backgroundColor: theme.colors.danger },
}));
