import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { AssessedSkill } from '@/domain/drills';
import { longestRun, type MissSide, type TargetRate } from '@/domain/stats';
import {
  Calendar,
  ChartCard,
  Ladder,
  Lines,
  MissSplit,
  niceTicks,
  SeriesLegend,
  Text,
  toneStyle,
} from '@/ui';

import { pct, shortDate } from '../format';

type Locked = { label: string; a11y: string; onPress: () => void } | undefined;

/** A locked-card prop for Pro views, or undefined when Pro is owned. */
export function useLock(proOwned: boolean, onPro: () => void) {
  const { t } = useTranslation('stats');
  return (title: string): Locked =>
    proOwned
      ? undefined
      : { label: t('pro.label'), a11y: t('pro.a11y', { title }), onPress: onPro };
}

/** Scores over sessions with the best marked and the last ten's average. */
export function TrendCard({
  title,
  scores,
  best,
  recent,
  format = (v) => String(Math.round(v)),
}: {
  title: string;
  scores: { at: number; score: number }[];
  best: number | null;
  recent: number | null;
  format?: (v: number) => string;
}) {
  const { t } = useTranslation('stats');
  const values = scores.map((s) => s.score);
  const scale = niceTicks(Math.min(0, ...values), Math.max(1, ...values));
  const last = values[values.length - 1];
  return (
    <ChartCard
      title={title}
      takeaway={
        recent !== null && values.length > 1 ? t('drill.recent', { value: format(recent) }) : null
      }
      testID="chart-trend"
    >
      {(w) =>
        values.length ? (
          <Lines
            width={w}
            series={[{ values, tone: 'you' }]}
            {...scale}
            format={format}
            xLabels={{
              start: shortDate(scores[0]!.at),
              end: shortDate(scores[scores.length - 1]!.at),
            }}
            mark={
              best !== null && values.length > 1
                ? {
                    series: 0,
                    index: best,
                    label: t('drill.bestMark', { score: format(values[best]!) }),
                  }
                : undefined
            }
            reference={
              recent !== null && values.length > 2
                ? { value: recent, from: Math.max(0, values.length - 10) }
                : undefined
            }
            accessibilityLabel={t('drill.trendA11y', {
              count: values.length,
              best: best !== null ? format(values[best]!) : '',
              last: last !== undefined ? format(last) : '',
            })}
          />
        ) : null
      }
    </ChartCard>
  );
}

/** Days played in the range, with the longest run. */
export function CalendarCard({
  title,
  days,
}: {
  title: string;
  days: { day: number; kinds: string[] }[];
}) {
  const { t } = useTranslation('stats');
  const active = days.filter((d) => d.kinds.length).length;
  const run = longestRun(days.map((d) => ({ day: d.day, active: d.kinds.length > 0 })));
  const longest =
    run && run.length > 1
      ? t('drill.longest', { count: run.length, from: shortDate(run.from), to: shortDate(run.to) })
      : null;
  return (
    <ChartCard
      title={title}
      right={
        <Text variant="caption" tone="muted">
          {t('drill.daysOf', { count: active, total: days.length })}
        </Text>
      }
      takeaway={longest}
      testID="chart-calendar"
    >
      {(w) => (
        <Calendar
          width={w}
          days={days}
          accessibilityLabel={t('drill.calendarA11y', {
            count: active,
            total: days.length,
            longest: longest ?? '',
          })}
        />
      )}
    </ChartCard>
  );
}

/** The double ladder: best doubles first. */
export function LadderCard({
  title,
  ladder,
  locked,
}: {
  title: string;
  ladder: TargetRate[];
  locked: Locked;
}) {
  const { t } = useTranslation('stats');
  const name = (r: TargetRate) => (r.segment === 25 ? t('closing.bull') : `D${r.segment}`);
  const rows = ladder.length > 8 ? [...ladder.slice(0, 4), ...ladder.slice(-4)] : ladder;
  return (
    <ChartCard
      title={title}
      locked={locked}
      takeaway={
        ladder.length > 1
          ? t('drill.ladderTakeaway', {
              best: name(ladder[0]!),
              worst: name(ladder[ladder.length - 1]!),
            })
          : ladder.length
            ? null
            : t('doubles.empty')
      }
      testID="chart-ladder"
    >
      {() => (
        <Ladder
          rows={rows.map((r) => ({
            key: String(r.segment),
            label: name(r),
            rate: r.rate,
            value: t('doubles.value', { pct: pct(r.rate) }),
            detail: t('doubles.detail', { hits: r.hits, darts: r.darts }),
          }))}
        />
      )}
    </ChartCard>
  );
}

/** Where darts at T20 went. */
export function MissCard({
  miss,
  locked,
}: {
  miss: { counts: Record<MissSide, number>; total: number };
  locked: Locked;
}) {
  const { t } = useTranslation('stats');
  const share = (k: MissSide) => (miss.total ? miss.counts[k] / miss.total : 0);
  const sides: MissSide[] = ['bed', 'high', 'low', 'left', 'right', 'other'];
  const cells = Object.fromEntries(
    sides.map((k) => [k, { share: share(k), label: t(`miss.${k}`) }]),
  ) as Record<MissSide, { share: number; label: string }>;
  return (
    <ChartCard
      title={t('miss.title')}
      locked={locked}
      takeaway={miss.total ? t('miss.takeaway', { count: miss.total }) : t('miss.empty')}
      testID="chart-miss"
    >
      {() =>
        miss.total ? (
          <MissSplit
            cells={cells}
            accessibilityLabel={t(
              'miss.a11y',
              Object.fromEntries(sides.map((k) => [k, pct(share(k))])) as Record<MissSide, number>,
            )}
          />
        ) : null
      }
    </ChartCard>
  );
}

const SKILLS: AssessedSkill[] = ['scoring', 'checkouts', 'doubles'];

/** Assessment levels over time, one line per skill. */
export function SkillsCard({
  skills,
  locked,
}: {
  skills: { at: number; levels: Record<AssessedSkill, number> }[];
  locked: Locked;
}) {
  const { t } = useTranslation('stats');
  const { theme } = useUnistyles();
  const tones = ['you', 'fourth', 'other'] as const;
  const latest = skills[skills.length - 1]?.levels;
  return (
    <ChartCard
      title={t('skills.title')}
      locked={locked}
      takeaway={latest ? t('skills.takeaway', latest) : t('skills.empty')}
      testID="chart-skills"
    >
      {(w) =>
        skills.length ? (
          <View style={styles.gap}>
            <Lines
              width={w}
              height={130}
              min={0}
              max={5}
              ticks={[1, 3, 5]}
              series={SKILLS.map((k, i) => ({
                values: skills.map((s) => s.levels[k]),
                tone: tones[i]!,
              }))}
              xLabels={{
                start: shortDate(skills[0]!.at),
                end: shortDate(skills[skills.length - 1]!.at),
              }}
              accessibilityLabel={t('skills.a11y', {
                takeaway: latest ? t('skills.takeaway', latest) : '',
              })}
            />
            <SeriesLegend
              items={SKILLS.map((k, i) => {
                const st = toneStyle(theme, tones[i]!);
                return { label: t(`skills.${k}`), color: st.color, dashed: !!st.dash };
              })}
            />
          </View>
        ) : null
      }
    </ChartCard>
  );
}

const styles = StyleSheet.create((theme) => ({
  gap: { gap: theme.spacing.s },
}));
