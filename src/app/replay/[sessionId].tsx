import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { drawPoint } from '@/domain/board';
import { label } from '@/domain/darts';
import { replayLegs } from '@/domain/games';
import { rowFormat } from '@/features/game/format';
import { loadGame } from '@/features/game/session';
import { Board, Header, Pressable, Screen, Text, type BoardMarker } from '@/ui';

/**
 * Replay (docs/design/screens.md → Replay): step through a leg visit by visit and see where
 * every dart landed, from the stored darts alone (ADR 0006).
 */
export default function Replay() {
  const { sessionId, leg: legParam } = useLocalSearchParams<{ sessionId: string; leg?: string }>();
  const { t } = useTranslation('game');
  const { theme } = useUnistyles();
  const game = useMemo(() => loadGame(sessionId), [sessionId]);
  const players = game.session.players;
  const legs = useMemo(
    () => replayLegs(game.def, game.session.settings, players, game.darts),
    [game, players],
  );
  const format = rowFormat(t, game.session.typeId);
  const [legIndex, setLegIndex] = useState(() =>
    Math.min(Math.max(0, Number(legParam ?? legs.length - 1) || 0), Math.max(0, legs.length - 1)),
  );
  const leg = legs[legIndex];
  const frames = leg?.frames ?? [];
  const [at, setAt] = useState(frames.length - 1);
  const [filter, setFilter] = useState<number | null>(null);
  const [size, setSize] = useState(0);

  const pickLeg = (i: number) => {
    setLegIndex(i);
    setAt((legs[i]?.frames.length ?? 1) - 1);
  };
  const step = (d: number) => setAt((a) => Math.min(frames.length - 1, Math.max(0, a + d)));
  const frame = frames[at];
  const maxTotal = Math.max(1, ...frames.map((f) => f.total));

  // Darts up to the chosen visit: earlier visits faded, the chosen one numbered.
  const markers: BoardMarker[] = frames
    .slice(0, at + 1)
    .filter((f) => filter === null || f.player === filter)
    .flatMap((f, _i, shown) =>
      f.darts.flatMap((d, n) => {
        const p = drawPoint(d);
        const current = f === frame;
        return p
          ? [{ point: p, text: current ? String(n + 1) : '', faded: !current && shown.length > 1 }]
          : [];
      }),
    );

  const visitNumber = (index: number) =>
    frames.slice(0, index + 1).filter((f) => f.player === frames[index]!.player).length;

  const title = leg
    ? legs.some((l) => l.set > 0)
      ? t('replay.titleSets', { set: leg.set + 1, leg: legIndex + 1 })
      : t('replay.title', { leg: legIndex + 1 })
    : t('summary.replay');

  const onLayout = (e: LayoutChangeEvent) =>
    setSize(Math.min(e.nativeEvent.layout.width, e.nativeEvent.layout.height));

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={title} backLabel={t('replay.back')} onBack={() => router.back()} />
      {legs.length > 1 ? (
        <ScrollView
          horizontal
          contentContainerStyle={styles.legRow}
          showsHorizontalScrollIndicator={false}
        >
          {legs.map((l, i) => (
            <Pressable
              key={l.leg}
              accessibilityRole="button"
              accessibilityState={{ selected: i === legIndex }}
              style={[styles.legChip, i === legIndex && styles.legChipOn]}
              onPress={() => pickLeg(i)}
            >
              <Text variant="bodyStrong" tone={i === legIndex ? 'onAccent' : 'text'}>
                {t('replay.legChip', { leg: i + 1 })}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {!frame ? (
        <Text tone="muted">{t('replay.empty')}</Text>
      ) : (
        <>
          <View style={styles.scores}>
            {frame.rows.map((r, i) => {
              const f = format?.(r);
              return (
                <View
                  key={r.playerId}
                  style={[styles.score, frame.player === i && styles.scoreActive]}
                  accessible
                  accessibilityLabel={
                    f?.a11y ?? t('replay.scoreA11y', { name: r.name, score: r.score })
                  }
                >
                  <Text variant="overline" tone="muted" numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text variant="heading" numberOfLines={1} adjustsFontSizeToFit>
                    {f?.big ?? r.score}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.board} onLayout={onLayout}>
            {size > 0 ? (
              <Board
                size={size}
                muted
                markers={markers}
                accessibilityLabel={t('replay.boardA11y', {
                  name: players[frame.player]!.name,
                  n: visitNumber(at),
                  leg: legIndex + 1,
                })}
              />
            ) : null}
          </View>
          <View style={styles.visit} accessibilityLiveRegion="polite">
            <View style={styles.flex}>
              <Text variant="overline" tone="muted">
                {t('replay.visit', { name: players[frame.player]!.name, n: visitNumber(at) })}
              </Text>
              <Text variant="title">{frame.darts.map((d) => label(d.hit)).join('  ')}</Text>
            </View>
            <Text variant="heading" tone={frame.bust ? 'danger' : 'accent'}>
              {frame.bust
                ? t('slots.bust')
                : frame.endsLeg
                  ? t('replay.checkout', { score: frame.total })
                  : frame.total}
            </Text>
          </View>
          <ScrollView
            horizontal
            accessibilityLabel={t('replay.visitsA11y')}
            contentContainerStyle={styles.chips}
            showsHorizontalScrollIndicator={false}
          >
            {frames.map((f, i) => (
              <Pressable
                key={f.index}
                accessibilityRole="button"
                accessibilityState={{ selected: i === at }}
                accessibilityLabel={t('replay.chipA11y', {
                  n: i + 1,
                  name: players[f.player]!.name,
                  total: f.bust ? t('slots.bust') : f.total,
                })}
                style={[styles.chip, i === at && styles.chipOn]}
                onPress={() => setAt(i)}
                testID={`frame-${i}`}
              >
                <View
                  style={[
                    styles.chipBar,
                    {
                      height: 6 + Math.min(1, f.total / maxTotal) * 30,
                      backgroundColor: f.bust
                        ? theme.colors.danger
                        : f.player === 0
                          ? theme.colors.accent
                          : theme.colors.muted,
                    },
                  ]}
                />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.controls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('replay.prev')}
              disabled={at === 0}
              style={styles.control}
              onPress={() => step(-1)}
              testID="replay-prev"
            >
              <Text variant="title">‹</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.control, styles.filter]}
              onPress={() =>
                setFilter((f) => (f === null ? 0 : f + 1 < players.length ? f + 1 : null))
              }
              testID="replay-filter"
            >
              <Text variant="bodyStrong">
                {filter === null
                  ? t('replay.filterAll')
                  : t('replay.filterOne', { name: players[filter]!.name })}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('replay.next')}
              disabled={at === frames.length - 1}
              style={styles.control}
              onPress={() => step(1)}
              testID="replay-next"
            >
              <Text variant="title">›</Text>
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  legRow: { gap: theme.spacing.s },
  legChip: {
    height: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
  },
  legChipOn: { backgroundColor: theme.colors.accent },
  scores: { flexDirection: 'row', gap: theme.spacing.s },
  score: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.s,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  scoreActive: { borderLeftColor: theme.colors.accent },
  board: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  visit: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
  },
  chips: { gap: 4, alignItems: 'flex-end', height: 44 },
  chip: {
    width: 22,
    height: 44,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  chipOn: { borderWidth: 2, borderColor: theme.colors.accent },
  chipBar: { width: 10, borderRadius: 3 },
  controls: { flexDirection: 'row', gap: theme.spacing.s },
  control: {
    width: 56,
    height: 52,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filter: { flex: 1 },
}));
