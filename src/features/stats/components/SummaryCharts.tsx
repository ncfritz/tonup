import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { PlayerRef } from '@/domain/darts';
import { VISIT_BANDS } from '@/domain/stats';
import {
  Bars,
  ChartCard,
  ClosingGrid,
  Ladder,
  Lines,
  niceTicks,
  NumberWheel,
  Pressable,
  RampLegend,
  RoundTable,
  SeriesLegend,
  Text,
  tonesFor,
  toneStyle,
} from '@/ui';

import { pct } from '../format';
import { FootballCard, KillerCard, ScamCard, TicTacToeCard } from './GameCharts';
import type { SummaryCharts as Data, WormLeg } from '../summary';

const bullLabel = (n: number, bull: string) => (n === 25 ? bull : String(n));

/** The charts under a match summary's stats table (docs/design/stats.md → Per game). */
export function SummaryCharts({
  charts,
  players,
  proOwned,
  onPro,
}: {
  charts: Data;
  players: PlayerRef[];
  proOwned: boolean;
  onPro: () => void;
}) {
  const { t } = useTranslation('stats');
  const { theme } = useUnistyles();
  const tones = tonesFor(players.length, charts.you);
  const legend = players.map((p, i) => {
    const st = toneStyle(theme, tones[i]!);
    return { label: p.name, color: st.color, dashed: !!st.dash };
  });
  const locked = (title: string) =>
    proOwned
      ? undefined
      : { label: t('pro.label'), a11y: t('pro.a11y', { title }), onPress: onPro };

  return (
    <>
      {charts.worm ? (
        <Worm
          kind={charts.worm.kind}
          legs={charts.worm.legs}
          players={players}
          tones={tones}
          legend={legend}
        />
      ) : null}

      {charts.visits ? (
        <ChartCard
          title={t('visits.title')}
          takeaway={visitsTakeaway(t, charts.visits[charts.you]!)}
          testID="chart-visits"
        >
          {(w) => (
            <>
              <Bars
                width={w}
                tones={tones}
                groups={VISIT_BANDS.map((b) => ({
                  label: t(`visits.bands.${b.key}`),
                  values: charts.visits!.map((v) => v[b.key]),
                }))}
                accessibilityLabel={t('visits.a11y', {
                  takeaway: visitsTakeaway(t, charts.visits![charts.you]!),
                })}
              />
              {players.length > 1 ? <SeriesLegend items={legend} /> : null}
            </>
          )}
        </ChartCard>
      ) : null}

      {charts.doubles ? (
        <ChartCard
          title={t('doubles.title')}
          locked={locked(t('doubles.title'))}
          takeaway={
            charts.doubles.length
              ? t('doubles.takeaway', {
                  hits: charts.doubles.reduce((n, r) => n + r.hits, 0),
                  darts: charts.doubles.reduce((n, r) => n + r.darts, 0),
                })
              : t('doubles.empty')
          }
          testID="chart-doubles"
        >
          {() => (
            <Ladder
              rows={charts.doubles!.slice(0, 8).map((r) => ({
                key: String(r.segment),
                label: r.segment === 25 ? t('closing.bull') : `D${r.segment}`,
                rate: r.rate,
                value: t('doubles.value', { pct: pct(r.rate) }),
                detail: t('doubles.detail', { hits: r.hits, darts: r.darts }),
              }))}
            />
          )}
        </ChartCard>
      ) : null}

      {charts.legs && charts.legs.length > 1 ? (
        <ChartCard title={t('legs.title')} testID="chart-legs">
          {() => (
            <View>
              <View style={styles.legRow}>
                <Text variant="caption" tone="muted" style={styles.legN}>
                  {t('legs.leg')}
                </Text>
                <Text variant="caption" tone="muted" style={styles.flex}>
                  {t('legs.winner')}
                </Text>
                <Text variant="caption" tone="muted" style={styles.legNum}>
                  {t('legs.darts')}
                </Text>
                <Text variant="caption" tone="muted" style={styles.legNum}>
                  {t('legs.average')}
                </Text>
                <Text variant="caption" tone="muted" style={styles.legNum}>
                  {t('legs.out')}
                </Text>
              </View>
              {charts.legs!.map((l, i) => (
                <View key={i} style={[styles.legRow, styles.legLine]}>
                  <Text tone="muted" style={styles.legN}>
                    {String(i + 1)}
                  </Text>
                  <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
                    {l.winner === null ? t('legs.none') : players[l.winner]!.name}
                  </Text>
                  <Text style={styles.legNum}>
                    {l.winner === null ? t('legs.none') : String(l.darts)}
                  </Text>
                  <Text style={styles.legNum}>
                    {l.winner === null ? t('legs.none') : l.average.toFixed(1)}
                  </Text>
                  <Text tone="muted" style={styles.legNum}>
                    {l.checkout === null ? t('legs.none') : String(l.checkout)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ChartCard>
      ) : null}

      {charts.closing && players.length > 1 ? <Closing charts={charts} players={players} /> : null}

      {charts.rounds ? (
        <ChartCard
          title={t(`rounds.${charts.rounds.kind}`)}
          takeaway={roundsTakeaway(t, charts.rounds.totals[charts.you] ?? [])}
          testID="chart-rounds"
        >
          {(w) => {
            const n = Math.max(...charts.rounds!.totals.map((r) => r.length));
            return (
              <>
                <Bars
                  width={w}
                  tones={tones}
                  showValues={n <= 10}
                  reference={charts.rounds!.kind === 'marks' ? 3 : undefined}
                  groups={Array.from({ length: n }, (_, r) => ({
                    label: String(r + 1),
                    values: charts.rounds!.totals.map((p) => p[r] ?? 0),
                  }))}
                  accessibilityLabel={t('rounds.a11y', {
                    title: t(`rounds.${charts.rounds!.kind}`),
                    takeaway: roundsTakeaway(t, charts.rounds!.totals[charts.you] ?? []),
                  })}
                />
                {players.length > 1 ? <SeriesLegend items={legend} /> : null}
                {charts.rounds!.kind === 'marks' ? (
                  <Text variant="caption" tone="muted">
                    {t('rounds.reference')}
                  </Text>
                ) : null}
              </>
            );
          }}
        </ChartCard>
      ) : null}

      {charts.wheel ? <Wheel wheel={charts.wheel} /> : null}
      {charts.killer ? <KillerCard tally={charts.killer} players={players} /> : null}
      {charts.football ? (
        <FootballCard figures={charts.football} players={players} you={charts.you} />
      ) : null}
      {charts.ticTacToe ? (
        <TicTacToeCard figures={charts.ticTacToe} players={players} you={charts.you} />
      ) : null}
      {charts.scam ? (
        <ScamCard innings={charts.scam} players={players} tones={tones} legend={legend} />
      ) : null}

      {charts.table ? (
        <ChartCard
          title={t(`table.${charts.table.kind}`)}
          takeaway={tableTakeaway(t, charts.table.kind, charts.table.totals[charts.you] ?? [])}
          testID="chart-table"
        >
          {() => {
            const mine = charts.table!.totals[charts.you] ?? [];
            const best = mine.length ? mine.indexOf(Math.max(...mine)) : -1;
            const highlight: [number, number][] =
              charts.table!.kind === 'golf'
                ? mine.flatMap((v, i) => (v === 1 ? [[charts.you, i] as [number, number]] : []))
                : best >= 0
                  ? [[charts.you, best]]
                  : [];
            const n = Math.max(...charts.table!.totals.map((r) => r.length));
            return (
              <RoundTable
                columns={Array.from({ length: n }, (_, i) => String(i + 1))}
                highlight={highlight}
                rows={players.map((p, i) => ({
                  name: p.name,
                  you: i === charts.you,
                  cells: Array.from({ length: n }, (_, r) => charts.table!.totals[i]?.[r] ?? null),
                  total: String(charts.table!.sums[i] ?? 0),
                }))}
              />
            );
          }}
        </ChartCard>
      ) : null}
    </>
  );
}

type T = ReturnType<typeof useTranslation<'stats'>>['t'];

function visitsTakeaway(t: T, bands: Record<string, number>) {
  let top = VISIT_BANDS[0].key as (typeof VISIT_BANDS)[number]['key'];
  for (const b of VISIT_BANDS) if ((bands[b.key] ?? 0) > (bands[top] ?? 0)) top = b.key;
  const tons = (bands.ton ?? 0) + (bands.ton40 ?? 0) + (bands.max ?? 0);
  return t('visits.takeaway', { band: t(`visits.words.${top}`), tons });
}

function roundsTakeaway(t: T, mine: number[]) {
  if (!mine.length) return null;
  const value = Math.max(...mine);
  return t('rounds.takeaway', { value, round: mine.indexOf(value) + 1 });
}

function tableTakeaway(t: T, kind: 'golf' | 'baseball', mine: number[]) {
  if (!mine.length) return null;
  if (kind === 'golf') return t('table.golfTakeaway', { ones: mine.filter((v) => v === 1).length });
  const runs = Math.max(...mine);
  return t('table.baseballTakeaway', { inning: mine.indexOf(runs) + 1, runs });
}

function Worm({
  kind,
  legs,
  players,
  tones,
  legend,
}: {
  kind: 'remaining' | 'points' | 'lives' | 'position';
  legs: WormLeg[];
  players: PlayerRef[];
  tones: ReturnType<typeof tonesFor>;
  legend: { label: string; color: string; dashed?: boolean }[];
}) {
  const { t } = useTranslation('stats');
  const [index, setIndex] = useState(legs.length - 1);
  const leg = legs[index];
  if (!leg) return null;
  const title =
    kind === 'remaining'
      ? legs.length > 1
        ? t('worm.titleLeg', { leg: index + 1 })
        : t('worm.title')
      : t(`worm.${kind === 'lives' ? 'lives' : kind === 'position' ? 'position' : 'points'}`);
  const takeaway = wormTakeaway(t, kind, leg, players);
  const all = leg.series.flat();
  const scale =
    kind === 'remaining'
      ? { min: 0, max: all[0] ?? 501, ticks: [0, Math.round((all[0] ?? 501) / 2), all[0] ?? 501] }
      : niceTicks(0, Math.max(1, ...all));
  const n = leg.series[0]?.length ?? 1;
  return (
    <ChartCard title={title} takeaway={takeaway} testID="chart-worm">
      {(w) => (
        <>
          {legs.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {legs.map((_, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === index }}
                  style={[styles.chip, i === index && styles.chipOn]}
                  onPress={() => setIndex(i)}
                  testID={`worm-leg-${i}`}
                >
                  <Text variant="bodyStrong" tone={i === index ? 'onAccent' : 'text'}>
                    {t('worm.legChip', { n: i + 1 })}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
          <Lines
            width={w}
            series={leg.series.map((values, p) => ({
              values,
              tone: tones[p]!,
              step: kind === 'lives',
            }))}
            {...scale}
            xLabels={{ start: t('worm.start'), end: t('worm.visit', { n: n - 1 }) }}
            accessibilityLabel={t('worm.a11y', { title, takeaway })}
          />
          {players.length > 1 ? <SeriesLegend items={legend} /> : null}
        </>
      )}
    </ChartCard>
  );
}

function wormTakeaway(
  t: T,
  kind: 'remaining' | 'points' | 'lives' | 'position',
  leg: WormLeg,
  players: PlayerRef[],
) {
  const last = leg.series.map((s) => s[s.length - 1] ?? 0);
  if (kind === 'remaining' && leg.won) {
    const w = leg.won.player;
    const others = last.map((v, i) => ({ v, i })).filter((x) => x.i !== w);
    const near = others.sort((a, b) => a.v - b.v)[0];
    if (!near) return null;
    return t('worm.checkedOut', {
      name: players[w]!.name,
      visit: leg.won.visit,
      other: players[near.i]!.name,
      left: near.v,
    });
  }
  if (kind === 'lives') {
    const w = last.findIndex((v) => v > 0 && last.filter((x) => x > 0).length === 1);
    if (w >= 0) return t('worm.livesLeft', { name: players[w]!.name, lives: last[w]! });
  }
  return t('worm.final', { scores: players.map((p, i) => `${p.name} ${last[i]}`).join(', ') });
}

function Closing({ charts, players }: { charts: Data; players: PlayerRef[] }) {
  const { t } = useTranslation('stats');
  const { theme } = useUnistyles();
  const grid = charts.closing!;
  const you = charts.you;
  const them = you === 0 ? 1 : 0;
  const mine = grid.closed[you]!;
  const theirs = grid.closed[them]!;
  const first = mine.filter((r, i) => r !== null && (theirs[i] === null || r <= theirs[i]!)).length;
  const takeaway = t('closing.takeaway', {
    name: players[you]!.name,
    count: first,
    total: grid.numbers.length,
  });
  const name = players[them]!.name;
  return (
    <ChartCard title={t('closing.title')} takeaway={takeaway} testID="chart-closing">
      {(w) => (
        <>
          <ClosingGrid
            width={w}
            numbers={grid.numbers.map((n) => bullLabel(n, t('closing.bull')))}
            you={mine}
            them={theirs}
            rounds={Math.max(1, grid.rounds)}
            accessibilityLabel={t('closing.a11y', { takeaway })}
          />
          <SeriesLegend
            items={[
              { label: t('closing.youClosed'), color: theme.colors.accent },
              { label: t('closing.themClosed', { name }), color: theme.colors.muted, dashed: true },
            ]}
          />
        </>
      )}
    </ChartCard>
  );
}

export function Wheel({ wheel }: { wheel: NonNullable<Data['wheel']> }) {
  const { t } = useTranslation('stats');
  const rates = wheel.rates.filter((r) => r.segment !== 25);
  const bull = wheel.rates.find((r) => r.segment === 25);
  const dpn = (r: { darts: number; hits: number }) => (r.hits ? r.darts / r.hits : r.darts);
  const fastest = Math.min(...rates.map(dpn), Infinity);
  const level = (r: { darts: number; hits: number; rate: number }) =>
    wheel.kind === 'darts' ? (Number.isFinite(fastest) ? fastest / dpn(r) : 0) : r.rate;
  const levels = Object.fromEntries(rates.map((r) => [r.segment, level(r)]));
  const texts =
    wheel.kind === 'darts'
      ? Object.fromEntries(rates.map((r) => [r.segment, String(Math.round(dpn(r)))]))
      : Object.fromEntries(rates.map((r) => [r.segment, `${pct(r.rate)}`]));
  let takeaway: string | null = null;
  if (rates.length) {
    if (wheel.kind === 'darts') {
      const slow = [...rates].sort((a, b) => dpn(b) - dpn(a)).slice(0, 3);
      takeaway = t('wheel.slowest', { numbers: slow.map((r) => r.segment).join(', ') });
    } else {
      const sorted = [...rates].sort((a, b) => b.rate - a.rate);
      takeaway = t('wheel.bestWorst', {
        best: sorted[0]!.segment,
        worst: sorted[sorted.length - 1]!.segment,
      });
    }
  }
  const title = t(`wheel.${wheel.kind}`);
  return (
    <ChartCard title={title} takeaway={takeaway} testID="chart-wheel">
      {(w) => (
        <View style={styles.center}>
          <NumberWheel
            size={Math.min(w, 320)}
            levels={levels}
            bull={bull ? level(bull) : null}
            texts={texts}
            accessibilityLabel={t('wheel.a11y', { title, takeaway: takeaway ?? '' })}
          />
          <RampLegend
            low={wheel.kind === 'darts' ? t('wheel.lowDarts') : t('wheel.lowRate')}
            high={wheel.kind === 'darts' ? t('wheel.highDarts') : t('wheel.highRate')}
          />
        </View>
      )}
    </ChartCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: theme.spacing.s },
  chips: { gap: theme.spacing.s },
  chip: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface2,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: theme.colors.accent },
  legRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s, minHeight: 36 },
  legLine: { borderTopWidth: 1, borderTopColor: theme.colors.surface2 },
  legN: { width: 32 },
  legNum: { width: 52, textAlign: 'right' },
}));
