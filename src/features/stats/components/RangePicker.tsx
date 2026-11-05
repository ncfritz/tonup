import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import {
  addDays,
  RANGE_PRESETS,
  rangeBounds,
  rangeDays,
  startOfDay,
  type StatsRange,
} from '@/domain/stats';
import { haptics } from '@/services/haptics';
import { firstFinishedAt } from '@/services/db/sessionsRepo';
import { Button, Icon, mix, Pressable, Text } from '@/ui';

import { longDate, monthTitle, rangeText } from '../format';

type Option = '30' | '60' | '90' | 'custom';

/**
 * The time range (docs/design/stats.md → Time range): 30, 60 and 90 days in one tap, Custom for
 * chosen dates. Drill pages and You share the choice through Settings.
 */
export function RangePicker({
  value,
  onChange,
  now,
}: {
  value: StatsRange;
  onChange: (r: StatsRange) => void;
  now: number;
}) {
  const { t } = useTranslation('stats');
  const [open, setOpen] = useState(false);
  const current: Option = value.kind === 'custom' ? 'custom' : (String(value.days) as Option);
  const options: { value: Option; label: string }[] = [
    ...RANGE_PRESETS.map((n) => ({ value: String(n) as Option, label: t('range.days', { n }) })),
    { value: 'custom', label: t('range.custom') },
  ];
  const pick = (o: Option) => {
    if (o === 'custom') {
      setOpen(true);
      return;
    }
    if (o === current) return;
    haptics.selection();
    onChange({ kind: 'days', days: Number(o) as 30 | 60 | 90 });
  };
  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('range.label')} style={styles.row}>
        {options.map((o) => {
          const selected = o.value === current;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              style={[styles.segment, selected && styles.selected]}
              onPress={() => pick(o.value)}
              testID={`range-${o.value}`}
            >
              <Text variant="bodyStrong" tone={selected ? 'text' : 'muted'}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {value.kind === 'custom' ? (
        <Text variant="caption" tone="muted">
          {t('range.customValue', rangeText(value, now))}
        </Text>
      ) : null}
      {open ? (
        <RangeSheet
          value={value}
          now={now}
          onClose={() => setOpen(false)}
          onApply={(r) => {
            setOpen(false);
            onChange(r);
          }}
        />
      ) : null}
    </View>
  );
}

/** Custom range: from and to dates on a month calendar, with This year and All time. */
function RangeSheet({
  value,
  now,
  onClose,
  onApply,
}: {
  value: StatsRange;
  now: number;
  onClose: () => void;
  onApply: (r: StatsRange) => void;
}) {
  const { t } = useTranslation('stats');
  const { theme } = useUnistyles();
  const initial = rangeBounds(value, now);
  const [from, setFrom] = useState(startOfDay(initial.from));
  const [to, setTo] = useState(startOfDay(initial.to));
  const [editing, setEditing] = useState<'from' | 'to'>('from');
  const [month, setMonth] = useState(() => {
    const d = new Date(from);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  });
  const today = startOfDay(now);

  const cells = useMemo(() => {
    const first = new Date(month);
    // Weeks start on Monday.
    const lead = (first.getDay() + 6) % 7;
    const out: (number | null)[] = Array.from({ length: lead }, () => null);
    for (let d = month; new Date(d).getMonth() === first.getMonth(); d = addDays(d, 1)) {
      out.push(d);
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const shiftMonth = (n: number) => {
    const d = new Date(month);
    setMonth(new Date(d.getFullYear(), d.getMonth() + n, 1).getTime());
  };
  const choose = (day: number) => {
    if (day > today) return;
    haptics.selection();
    if (editing === 'from') {
      setFrom(day);
      if (day > to) setTo(day);
      setEditing('to');
    } else if (day < from) {
      setFrom(day);
    } else {
      setTo(day);
    }
  };
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const range: StatsRange = { kind: 'custom', from: lo, to: hi };
  const band = mix(theme.colors.surface2, theme.colors.accent, 0.3);
  const weekdays = t('range.weekdays').split(',');

  const set = (a: number, b: number) => {
    setFrom(startOfDay(a));
    setTo(startOfDay(b));
    const d = new Date(a);
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1).getTime());
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.sheetHead}>
          <Text variant="title" accessibilityRole="header" style={styles.flex}>
            {t('range.title')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('range.close')}
            style={styles.icon}
            onPress={onClose}
          >
            <Icon name="close" color={theme.colors.text} size={18} />
          </Pressable>
        </View>
        <View style={styles.fields}>
          {(['from', 'to'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: editing === k }}
              accessibilityLabel={`${t(`range.${k}`)}: ${longDate(k === 'from' ? lo : hi)}`}
              style={[styles.field, editing === k && styles.fieldOn]}
              onPress={() => setEditing(k)}
              testID={`range-${k}`}
            >
              <Text variant="caption" tone="muted">
                {t(`range.${k}`)}
              </Text>
              <Text variant="bodyStrong">{longDate(k === 'from' ? lo : hi)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.monthRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('range.prevMonth')}
            style={styles.icon}
            onPress={() => shiftMonth(-1)}
          >
            <View style={styles.flip}>
              <Icon name="chevron" color={theme.colors.text} size={18} />
            </View>
          </Pressable>
          <Text variant="bodyStrong" style={styles.monthTitle}>
            {monthTitle(month)}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('range.nextMonth')}
            style={styles.icon}
            onPress={() => shiftMonth(1)}
          >
            <Icon name="chevron" color={theme.colors.text} size={18} />
          </Pressable>
        </View>
        <View style={styles.week}>
          {weekdays.map((w, i) => (
            <Text key={i} variant="caption" tone="muted" style={styles.dayCell}>
              {w}
            </Text>
          ))}
        </View>
        <View style={styles.days}>
          {cells.map((d, i) => {
            if (d === null) return <View key={i} style={styles.dayCell} />;
            const end = d === lo || d === hi;
            const inside = d > lo && d < hi;
            const future = d > today;
            return (
              <View
                key={i}
                style={[
                  styles.dayCell,
                  (inside || (end && lo !== hi)) && { backgroundColor: band },
                  d === lo && lo !== hi && styles.bandStart,
                  d === hi && lo !== hi && styles.bandEnd,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: end, disabled: future }}
                  accessibilityLabel={longDate(d)}
                  disabled={future}
                  style={[styles.day, end && styles.dayEnd]}
                  onPress={() => choose(d)}
                >
                  <Text
                    variant={end ? 'bodyStrong' : 'body'}
                    tone={end ? 'onAccent' : future ? 'muted' : 'text'}
                  >
                    {String(new Date(d).getDate())}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        <View style={styles.quick}>
          <Pressable
            accessibilityRole="button"
            style={styles.chip}
            onPress={() => set(new Date(new Date(now).getFullYear(), 0, 1).getTime(), today)}
          >
            <Text variant="bodyStrong">{t('range.thisYear')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.chip}
            onPress={() => set(firstFinishedAt() ?? today, today)}
            testID="range-all"
          >
            <Text variant="bodyStrong">{t('range.allTime')}</Text>
          </Pressable>
        </View>
        <View style={styles.flex} />
        <Button
          label={t('range.show', { count: rangeDays(range, now) })}
          onPress={() => onApply(range)}
          testID="range-apply"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.xs },
  row: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: theme.radii.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: theme.colors.line },
  flex: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.l,
    gap: theme.spacing.m,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center' },
  icon: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.m,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  flip: { transform: [{ rotate: '180deg' }] },
  fields: { flexDirection: 'row', gap: theme.spacing.s },
  field: {
    flex: 1,
    padding: theme.spacing.m,
    borderRadius: theme.radii.m,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface2,
  },
  fieldOn: { borderColor: theme.colors.accent },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  days: { flexDirection: 'row', flexWrap: 'wrap', rowGap: theme.spacing.xs },
  dayCell: {
    width: `${100 / 7}%`,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  bandStart: { borderTopLeftRadius: 22, borderBottomLeftRadius: 22 },
  bandEnd: { borderTopRightRadius: 22, borderBottomRightRadius: 22 },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayEnd: { backgroundColor: theme.colors.accent },
  quick: { flexDirection: 'row', gap: theme.spacing.s },
  chip: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.m,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
    justifyContent: 'center',
  },
}));
