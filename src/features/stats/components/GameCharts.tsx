import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { PlayerRef } from '@/domain/darts';
import { SCAM_TARGETS } from '@/domain/games/scam';
import type { FootballFigures, KillerTally, ScamInning, TicTacToeFigures } from '@/domain/stats';
import {
  Bars,
  CellGrid,
  ChartCard,
  ClaimGrid,
  RampLegend,
  SeriesLegend,
  Text,
  type SeriesTone,
} from '@/ui';

import { fmt1 } from '../format';

/** Killer: who took whose lives, and how each player went out. */
export function KillerCard({ tally, players }: { tally: KillerTally; players: PlayerRef[] }) {
  const { t } = useTranslation('stats');
  const totals = tally.taken.map((row, a) => row.reduce((n, v, b) => (a === b ? n : n + v), 0));
  const top = totals.indexOf(Math.max(...totals));
  return (
    <ChartCard
      title={t('killer.title')}
      takeaway={
        totals[top] ? t('killer.takeaway', { name: players[top]!.name, count: totals[top] }) : null
      }
      testID="chart-killer"
    >
      {() => (
        <View>
          {players.map((p, a) => {
            const from = tally.taken[a]!.flatMap((v, b) =>
              b !== a && v ? [t('killer.from', { count: v, name: players[b]!.name })] : [],
            );
            const own = tally.taken[a]![a]!;
            const took = [t('killer.took', { count: totals[a]! }), ...from].join(' · ');
            const out = tally.out[a];
            const fate = !out
              ? t('killer.survived')
              : out.by === a
                ? t('killer.outOwn', { round: out.round })
                : t('killer.outBy', { round: out.round, name: players[out.by]!.name });
            return (
              <View
                key={p.id}
                style={styles.row}
                accessible
                accessibilityLabel={t('killer.rowA11y', { name: p.name, took, fate })}
              >
                <Text variant="bodyStrong">{p.name}</Text>
                <Text variant="caption" tone="muted">
                  {took}
                </Text>
                {own ? (
                  <Text variant="caption" tone="muted">
                    {t('killer.ownDouble', { count: own })}
                  </Text>
                ) : null}
                <Text variant="caption">{fate}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ChartCard>
  );
}

/** Football: darts to win the ball and per goal, per player. */
export function FootballCard({
  figures,
  players,
  you,
}: {
  figures: FootballFigures;
  players: PlayerRef[];
  you: number;
}) {
  const { t } = useTranslation('stats');
  const f = (v: number | null) => (v === null ? t('drill.none') : fmt1(v));
  const me = players[you]!;
  return (
    <ChartCard
      title={t('football.title')}
      takeaway={
        figures.dartsToWin[you] !== null && figures.dartsPerGoal[you] !== null
          ? t('football.takeaway', {
              name: me.name,
              toWin: f(figures.dartsToWin[you]!),
              perGoal: f(figures.dartsPerGoal[you]!),
            })
          : null
      }
      testID="chart-football"
    >
      {() => (
        <View>
          <View style={styles.tableRow}>
            <View style={styles.flex} />
            {players.map((p) => (
              <Text key={p.id} variant="caption" tone="muted" style={styles.num} numberOfLines={1}>
                {p.name}
              </Text>
            ))}
          </View>
          {(
            [
              ['toWin', figures.dartsToWin],
              ['perGoal', figures.dartsPerGoal],
              ['possessions', figures.possessions],
            ] as const
          ).map(([key, values]) => (
            <View key={key} style={[styles.tableRow, styles.line]}>
              <Text tone="muted" style={styles.flex}>
                {t(`football.${key}`)}
              </Text>
              {values.map((v, i) => (
                <Text key={i} variant="bodyStrong" style={styles.num}>
                  {f(v)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </ChartCard>
  );
}

/** Tic-Tac-Toe: the grid as it ended, numbered in the order squares were won. */
export function TicTacToeCard({
  figures,
  players,
  you,
}: {
  figures: TicTacToeFigures;
  players: PlayerRef[];
  you: number;
}) {
  const { t } = useTranslation('stats');
  const bull = t('closing.bull');
  const by = new Map(figures.claims.map((c) => [c.cell, c]));
  const list = figures.cells
    .map((target, cell) => {
      const name = target === 25 ? bull : String(target);
      const c = by.get(cell);
      return c
        ? t('ticTacToe.square', { target: name, name: players[c.player]!.name, order: c.order })
        : t('ticTacToe.open', { target: name });
    })
    .join('; ');
  const per = figures.dartsPerSquare[you];
  return (
    <ChartCard
      title={t('ticTacToe.title')}
      takeaway={
        per === null || per === undefined
          ? null
          : t('ticTacToe.takeaway', { name: players[you]!.name, darts: fmt1(per) })
      }
      testID="chart-tictactoe"
    >
      {() => (
        <ClaimGrid
          cells={figures.cells}
          claims={figures.claims}
          you={you}
          bull={bull}
          accessibilityLabel={t('ticTacToe.a11y', { list })}
        />
      )}
    </ChartCard>
  );
}

/** Scam: which of the stopper's visits closed each number, and numbers stopped per visit. */
export function ScamCard({
  innings,
  players,
  tones,
  legend,
}: {
  innings: ScamInning[];
  players: PlayerRef[];
  tones: SeriesTone[];
  legend: { label: string; color: string; dashed?: boolean }[];
}) {
  const { t } = useTranslation('stats');
  const done = innings.filter((i) => i.closedOn.every((v) => v !== null));
  const [a, b] = done;
  const takeaway =
    a && b
      ? t('scam.takeaway', {
          name: players[a.stopper]!.name,
          visits: a.stopperVisits,
          other: players[b.stopper]!.name,
          otherVisits: b.stopperVisits,
        })
      : null;
  const most = Math.max(1, ...innings.map((i) => i.stopperVisits));
  const visits = Math.max(...innings.map((i) => i.stoppedPerVisit.length));
  return (
    <ChartCard title={t('scam.title')} takeaway={takeaway} testID="chart-scam">
      {(w) => (
        <View style={styles.gap}>
          <CellGrid
            width={w}
            columns={SCAM_TARGETS.map((n) => (n === 25 ? 'B' : String(n)))}
            rows={innings.map((i) => ({
              label: players[i.stopper]!.name.slice(0, 4),
              cells: i.closedOn.map((v) => (v === null ? null : 1 - (v - 1) / most)),
            }))}
            accessibilityLabel={t('scam.gridA11y', { takeaway: takeaway ?? '' })}
          />
          <RampLegend low={t('scam.earlier')} high={t('scam.sooner')} />
          <Text variant="caption" tone="muted">
            {t('scam.perVisit')}
          </Text>
          <Bars
            width={w}
            height={110}
            tones={innings.map((i) => tones[i.stopper]!)}
            groups={Array.from({ length: visits }, (_, k) => ({
              label: String(k + 1),
              values: innings.map((i) => i.stoppedPerVisit[k] ?? 0),
            }))}
            accessibilityLabel={t('scam.barsA11y')}
          />
          <SeriesLegend
            items={innings
              .map((i) => legend[i.stopper]!)
              .map((l, k) => ({
                ...l,
                label: t('scam.stopping', { name: players[innings[k]!.stopper]!.name }),
              }))}
          />
        </View>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  gap: { gap: theme.spacing.s },
  row: {
    gap: theme.spacing.xxs,
    paddingVertical: theme.spacing.s,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surface2,
  },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s, minHeight: 36 },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.surface2 },
  num: { width: 64, textAlign: 'right' },
}));
