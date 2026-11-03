import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { GameId } from '@/domain/games';
import { deal } from '@/features/game/presets';
import { formatStat, gameName } from '@/features/game/format';
import { loadGame, sessionStats, sessionX01Stats, startGame } from '@/features/game/session';
import { Button, Header, Screen, Text } from '@/ui';

/** The match summary: result and each player's stats (docs/design/screens.md). */
export default function Summary() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation('game');
  const game = useMemo(() => loadGame(sessionId), [sessionId]);
  const result = game.def.result(game.state);
  const players = game.session.players;
  const isX01 = game.session.typeId === 'x01';
  const winner = players.find((p) => p.id === result?.winnerId);
  const score = result && isX01 ? players.map((p) => result.score[p.id] ?? 0).join('–') : '';
  const rows = isX01 ? x01Rows() : genericRows();

  function genericRows(): { label: string; value: (i: number) => string }[] {
    const lines = players.map((p) => sessionStats(game, p.id));
    return (lines[0] ?? []).map((line, k) => ({
      label: t(`stats.${line.key}` as 'stats.mpr'),
      value: (i: number) => formatStat(lines[i]![k]!),
    }));
  }

  function x01Rows(): { label: string; value: (i: number) => string }[] {
    const stats = players.map((p) => sessionX01Stats(game, p.id));
    return [
      { label: t('summary.average'), value: (i) => stats[i]!.average.toFixed(1) },
      { label: t('summary.first9'), value: (i) => stats[i]!.first9Average.toFixed(1) },
      {
        label: t('summary.checkout'),
        value: (i) => {
          const s = stats[i]!;
          return s.checkoutRate === null
            ? t('summary.none')
            : t('summary.checkoutValue', {
                rate: Math.round(s.checkoutRate * 100),
                hits: s.checkouts,
                attempts: s.checkoutAttempts,
              });
        },
      },
      {
        label: t('summary.highest'),
        value: (i) =>
          stats[i]!.highestCheckout ? String(stats[i]!.highestCheckout) : t('summary.none'),
      },
      {
        label: t('summary.tons'),
        value: (i) => `${stats[i]!.tons} / ${stats[i]!.ton40s} / ${stats[i]!.oneEighties}`,
      },
      {
        label: t('summary.bestLeg'),
        value: (i) =>
          stats[i]!.bestLeg === null
            ? t('summary.none')
            : t('summary.bestLegValue', { darts: stats[i]!.bestLeg }),
      },
    ];
  }

  const rematch = () => {
    const { typeId, settings } = game.session;
    // Killer numbers and Random Cricket's six are drawn again.
    const id = startGame(
      typeId as GameId,
      deal(typeId as GameId, settings as Record<string, unknown>, players),
      players,
    );
    router.replace({ pathname: '/game/[sessionId]', params: { sessionId: id } });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('summary.title')}
        backLabel={t('summary.done')}
        onBack={() => router.navigate('/')}
      />
      <View>
        <Text variant="heading" accessibilityRole="header">
          {winner
            ? t('summary.winner', { name: winner.name })
            : result
              ? t('summary.draw')
              : t('summary.title')}
        </Text>
        {score ? (
          <Text variant="score" tone="accent">
            {score}
          </Text>
        ) : (
          <Text tone="muted">{gameName(t, game.session.typeId, game.session.settings)}</Text>
        )}
      </View>
      <View style={styles.table}>
        <View style={styles.row}>
          <Text variant="caption" tone="muted" style={styles.label} />
          {players.map((p) => (
            <Text key={p.id} variant="bodyStrong" style={styles.cell} numberOfLines={1}>
              {p.name}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text variant="caption" tone="muted" style={styles.label}>
              {r.label}
            </Text>
            {players.map((p, i) => (
              <Text key={p.id} variant="value" style={styles.cell}>
                {r.value(i)}
              </Text>
            ))}
          </View>
        ))}
      </View>
      <Button label={t('summary.rematch')} onPress={rematch} testID="rematch" />
      <Button
        kind="secondary"
        label={t('summary.replay')}
        onPress={() => router.push({ pathname: '/replay/[sessionId]', params: { sessionId } })}
        testID="replay"
      />
      <Button kind="secondary" label={t('summary.done')} onPress={() => router.navigate('/')} />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  table: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.m,
    gap: theme.spacing.s,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  label: { flex: 1.3 },
  cell: { flex: 1, textAlign: 'right' },
}));
