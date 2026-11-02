import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { label } from '@/domain/darts';
import type { ScoreboardView } from '@/domain/games';

import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * The broadcast-style scoreboard (docs/design/screens.md → Scoring): one row per player with
 * legs (and sets) and the score, the player at the oche marked with the accent bar, and the
 * strip below: the checkout route, Bust, Game shot or No finish.
 */
export function Scoreboard({ view, showSets }: { view: ScoreboardView; showSets: boolean }) {
  const { t } = useTranslation('game');
  const compact = view.rows.length > 3;
  const strip = stripText(view, t);
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      {view.rows.map((r) => (
        <View
          key={r.playerId}
          style={[styles.row, r.active && styles.rowActive, compact && styles.rowCompact]}
          accessible
          accessibilityLabel={t('scoreboard.rowA11y', {
            name: r.name,
            score: r.score,
            legs: r.legs,
            sets: r.sets,
            showSets: showSets ? 'yes' : 'no',
          })}
          accessibilityState={{ selected: r.active }}
        >
          <View style={[styles.bar, r.active && styles.barActive]} />
          <Text
            variant="title"
            tone={r.active ? 'text' : 'muted'}
            style={styles.name}
            numberOfLines={1}
          >
            {r.name}
          </Text>
          {showSets ? (
            <Text variant="value" tone="accent" style={styles.count}>
              {r.sets}
            </Text>
          ) : null}
          <Text variant="value" tone="accent" style={styles.count}>
            {r.legs}
          </Text>
          <Text
            variant="score"
            tone={r.active ? 'text' : 'muted'}
            style={[styles.score, !r.active && styles.scoreIdle, compact && styles.scoreCompact]}
          >
            {r.score}
          </Text>
        </View>
      ))}
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

type T = ReturnType<typeof useTranslation<'game'>>['t'];

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
    default:
      return { left: '', right: '', danger: false };
  }
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
    height: 48,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.bg,
  },
  rowActive: { height: 56, backgroundColor: theme.colors.surface2 },
  rowCompact: { height: 40 },
  bar: { width: 10, alignSelf: 'stretch' },
  barActive: { backgroundColor: theme.colors.accent },
  name: { flex: 1, paddingLeft: theme.spacing.s, textTransform: 'uppercase' },
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
