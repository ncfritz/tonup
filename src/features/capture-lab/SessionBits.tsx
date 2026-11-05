// Pieces the Sessions screens share: the labelled / values only / to label bar and counts,
// and a session's set.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon, Pressable, Text, type IconName } from '@/ui';

import { useMemo } from 'react';

import { useLab } from './LabBits';
import { fetchLabSessions } from './labData';
import { labStanding, type SessionSummary } from './outbox';

/** Quick tags, one from each group (docs/plan/capture-lab.md › Screens › Session). */
export const TAG_GROUPS = [
  ['lightOn', 'lightOff', 'daylight'],
  ['left', 'centre', 'right'],
] as const;
export type TagKey = (typeof TAG_GROUPS)[number][number];

const TAG_ICON: Record<TagKey, IconName> = {
  lightOn: 'lightOn',
  lightOff: 'lightOff',
  daylight: 'daylight',
  left: 'standLeft',
  centre: 'standCentre',
  right: 'standRight',
};

/**
 * The quick tags as chips, a row per group, every chip the same width with its icon. `on` says
 * which are set; `tone` is the chips' fill when off (the surface they sit on decides it).
 */
export function TagChips({
  on,
  onToggle,
  tone = 'surface',
  testID = 'tag',
}: {
  on: (k: TagKey) => boolean;
  onToggle: (k: TagKey) => void;
  tone?: 'surface' | 'surface2';
  testID?: string;
}) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  return (
    <View style={styles.tagRows}>
      {TAG_GROUPS.map((group) => (
        <View key={group[0]} style={styles.tagRow}>
          {group.map((k) => {
            const set = on(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: set }}
                style={[styles.tag, { backgroundColor: theme.colors[tone] }, set && styles.tagOn]}
                onPress={() => onToggle(k)}
                testID={`${testID}-${k}`}
              >
                <Icon
                  name={TAG_ICON[k]}
                  size={16}
                  color={set ? theme.colors.onAccent : theme.colors.text}
                />
                <Text
                  variant="caption"
                  tone={set ? 'onAccent' : 'text'}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={styles.tagText}
                >
                  {t(`session.tags.${k}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Turns one tag on, and the others in its group off (tags are stored as their text). */
export function toggleTag(tags: string[], k: TagKey, text: (k: TagKey) => string): string[] {
  const group = TAG_GROUPS.find((g) => (g as readonly TagKey[]).includes(k))!;
  const others = (group as readonly TagKey[]).filter((g) => g !== k).map(text);
  const on = tags.includes(text(k));
  const rest = tags.filter((x) => !others.includes(x) && x !== text(k));
  return on ? rest : [...rest, text(k)];
}

/** "Mon, Nov 2, 9:02 PM". */
export const sessionWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

type Counts = Pick<SessionSummary, 'labelled' | 'valuesOnly' | 'unlabelled'>;

/** One bar split into labelled, values only and to label. */
export function StatusBar({ counts, thick = false }: { counts: Counts; thick?: boolean }) {
  const { t } = useTranslation('capture');
  const parts = [
    [counts.labelled, styles.labelled],
    [counts.valuesOnly, styles.valuesOnly],
    [counts.unlabelled, styles.unlabelled],
  ] as const;
  return (
    <View
      accessible
      accessibilityLabel={t('home.barA11y', counts)}
      style={[styles.bar, thick && styles.barThick]}
    >
      {parts.map(([n, style], i) => (n ? <View key={i} style={[style, { flex: n }]} /> : null))}
    </View>
  );
}

/** "20 labelled · 2 values only · 4 to label" (or "All done"). */
export function StatusLine({ counts }: { counts: Counts }) {
  const { t } = useTranslation('capture');
  return (
    <View style={styles.line}>
      <Text variant="caption" tone="muted">
        {t('home.labelled', { count: counts.labelled })}
      </Text>
      <Text variant="caption" tone="muted">
        {t('home.valuesOnly', { count: counts.valuesOnly })}
      </Text>
      {counts.unlabelled ? (
        <Text variant="caption" tone="pending">
          {t('home.toLabel', { count: counts.unlabelled })}
        </Text>
      ) : (
        <Text variant="caption" tone="accent">
          {t('home.allDone')}
        </Text>
      )}
    </View>
  );
}

/** The session IDs Lab has, asked while the screen is in view; null until it answers. */
export function useLabSessionIds() {
  const { reply, reload } = useLab(fetchLabSessions);
  const ids = useMemo(() => (reply?.ok ? new Set(reply.data.ids) : null), [reply]);
  return { ids, reload };
}

/**
 * Why a session on the phone isn't on Lab: not there yet (waiting to be sent, or to be labelled
 * first), or deleted there. Nothing when Lab has it, or when Lab's list isn't known.
 */
export function StandingLine({
  s,
  labIds,
}: {
  s: Pick<SessionSummary, 'id' | 'visits' | 'sent' | 'pending' | 'unlabelled'>;
  labIds: ReadonlySet<string> | null;
}) {
  const { t } = useTranslation('capture');
  const standing = labStanding(s, labIds);
  // A session just started, with nothing in it yet, isn't missing from anywhere.
  if (!standing || standing === 'onLab' || !s.visits) return null;
  return (
    <Text
      variant="caption"
      tone={standing === 'deleted' ? 'danger' : 'pending'}
      testID={`standing-${s.id}`}
    >
      {standing === 'deleted'
        ? t('standing.deleted', { count: s.sent })
        : s.pending
          ? t('standing.sending', { count: s.pending })
          : s.unlabelled
            ? t('standing.toLabel', { count: s.unlabelled })
            : t('standing.notYet')}
    </Text>
  );
}

/** The set Lab put a session in (it says once the session's first visit is sent). */
export function SplitChip({ split }: { split: SessionSummary['split'] }) {
  const { t } = useTranslation('capture');
  if (!split) return null;
  styles.useVariants({ split });
  return (
    <View style={styles.chip}>
      <Text
        variant="caption"
        tone={split === 'train' ? 'onAccent' : split === 'test' ? 'pending' : 'text'}
      >
        {t(`home.split.${split}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  tagRows: { gap: theme.spacing.xs },
  tagRow: { flexDirection: 'row', gap: theme.spacing.xs },
  tag: {
    flex: 1,
    flexBasis: 0,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.s,
    borderRadius: 18,
  },
  tagOn: { backgroundColor: theme.colors.accent },
  tagText: { flexShrink: 1 },
  bar: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface2,
  },
  barThick: { height: 10, borderRadius: 5 },
  labelled: { backgroundColor: theme.colors.accent },
  valuesOnly: { backgroundColor: theme.colors.info },
  unlabelled: { backgroundColor: theme.colors.pending },
  line: { flexDirection: 'row', flexWrap: 'wrap', columnGap: theme.spacing.m },
  chip: {
    borderRadius: 6,
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xxs,
    variants: {
      split: {
        train: { backgroundColor: theme.colors.accent },
        test: { backgroundColor: theme.colors.pendingSoft },
        val: { backgroundColor: theme.colors.surface2 },
      },
    },
  },
}));
