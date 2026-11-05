import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import {
  labelQueue,
  sessionPhotos,
  sessionsOn,
  type PhotoStatus,
  type SessionPhoto,
  type SessionSummary,
} from '@/features/capture-lab/outbox';
import { fileDrafts, fileOutbox } from '@/features/capture-lab/outboxFiles';
import { addTips, startLabelling } from '@/features/capture-lab/queue';
import {
  sessionWhen,
  SplitChip,
  StandingLine,
  StatusBar,
  useLabSessionIds,
} from '@/features/capture-lab/SessionBits';
import { labStanding } from '@/features/capture-lab/outbox';
import { labPhotoUrl } from '@/features/capture-lab/lab';
import { LabPill, useLabState } from '@/features/capture-lab/LabPill';
import { useCapture } from '@/features/capture-lab/store';
import { Button, Header, Pressable, TAB_BAR_SPACE, Text } from '@/ui';

type Filter = 'all' | PhotoStatus;
const COLUMNS = 5;

/** One session's photos, marked labelled, values only or to label, and labelling what's left. */
export default function SessionPhotos() {
  const { t } = useTranslation('capture');
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [photos, setPhotos] = useState<SessionPhoto[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const { ids: labIds } = useLabSessionIds();
  const labUrl = useCapture((s) => s.labUrl);
  const labOk = useLabState() === 'ok';

  const load = useCallback(() => {
    try {
      setSummary(sessionsOn(fileOutbox, fileDrafts).find((s) => s.id === id) ?? null);
      setPhotos(sessionPhotos(fileOutbox, fileDrafts, id));
    } catch {
      setPhotos([]);
    }
  }, [id]);
  useFocusEffect(load);

  // Deleted in Lab: the sent photos can go from the phone too (what's still to label or send
  // stays). With nothing left, the session goes, so back to the list.
  const deleted = summary ? labStanding(summary, labIds) === 'deleted' : false;
  const removeSent = () => {
    if (!summary) return;
    Alert.alert(t('standing.removeTitle'), t('standing.removeBody', { count: summary.sent }), [
      { text: t('standing.cancel'), style: 'cancel' },
      {
        text: t('standing.removeConfirm'),
        style: 'destructive',
        onPress: () => {
          fileOutbox.forgetSent(id);
          if (summary.visits === summary.sent) router.back();
          else load();
        },
      },
    ]);
  };

  const shown = photos.filter((p) => filter === 'all' || p.status === filter);
  const tile = Math.floor((width - 32 - (COLUMNS - 1) * 6) / COLUMNS);
  const queue = () => labelQueue(fileDrafts, { session: id });
  const filters: {
    key: Filter;
    n: number;
    label: string;
    tone: 'text' | 'accent' | 'info' | 'pending';
  }[] = summary
    ? [
        { key: 'all', n: summary.visits, label: t('photos.all'), tone: 'text' },
        { key: 'labelled', n: summary.labelled, label: t('photos.labelled'), tone: 'accent' },
        { key: 'values-only', n: summary.valuesOnly, label: t('photos.valuesOnly'), tone: 'info' },
        { key: 'unlabelled', n: summary.unlabelled, label: t('photos.toLabel'), tone: 'pending' },
      ]
    : [];

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.pad}>
        <Header
          title={summary ? sessionWhen(summary.startedAt) : ''}
          backLabel={t('photos.back')}
          onBack={() => router.back()}
          right={<LabPill />}
        />
        {summary ? (
          <View style={styles.sub}>
            <Text variant="caption" tone="muted" style={styles.flex}>
              {[t('home.photos', { count: summary.visits }), ...summary.tags].join(' · ')}
            </Text>
            <SplitChip split={summary.split} />
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {summary ? (
          <>
            <View accessibilityRole="radiogroup" style={styles.filters}>
              {filters.map((f) => (
                <Pressable
                  key={f.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: filter === f.key }}
                  style={[styles.filter, filter === f.key && styles.filterOn]}
                  onPress={() => setFilter(f.key)}
                  testID={`photos-filter-${f.key}`}
                >
                  <Text variant="value" tone={f.n ? f.tone : 'muted'}>{`${f.n}`}</Text>
                  <Text variant="caption" tone="muted" numberOfLines={1}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <StatusBar counts={summary} />
            <StandingLine s={summary} labIds={labIds} />
            {deleted ? (
              <Button
                kind="secondary"
                label={t('standing.remove')}
                onPress={removeSent}
                testID="photos-forget"
              />
            ) : null}
          </>
        ) : null}
        {shown.length === 0 ? (
          <Text tone="muted">{t('photos.none')}</Text>
        ) : (
          <View style={styles.grid}>
            {shown.map((p) => {
              const n = photos.indexOf(p) + 1;
              const label =
                p.status === 'unlabelled'
                  ? t('photos.tileToLabel', { n })
                  : p.status === 'values-only'
                    ? t('photos.tileValuesOnly', { n, total: p.total })
                    : t('photos.tileLabelled', { n, total: p.total });
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  style={[styles.tile, { width: tile, height: tile }]}
                  onPress={() =>
                    p.status === 'unlabelled'
                      ? void startLabelling(queue(), p.id)
                      : p.status === 'values-only' && p.uri
                        ? addTips(p.id)
                        : router.push(`/photo/${p.id}`)
                  }
                  testID={`photo-${p.id}`}
                >
                  <Thumb photo={p} fromLab={labOk && labIds?.has(id) ? labUrl : null} />
                  <Badge photo={p} />
                </Pressable>
              );
            })}
          </View>
        )}
        {/* With no Label button, the last row still clears the tab bar. */}
        {summary?.unlabelled ? null : <View style={styles.bodyEnd} />}
      </ScrollView>

      {summary?.unlabelled ? (
        <View style={styles.footer}>
          <Button
            label={t('photos.labelN', { count: summary.unlabelled })}
            onPress={() => void startLabelling(queue())}
            testID="photos-label"
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * A photo's tile: the phone's copy; once cleared, Lab's thumbnail (when Lab's up and has the
 * session); else "Cleared".
 */
function Thumb({ photo, fromLab }: { photo: SessionPhoto; fromLab: string | null }) {
  const { t } = useTranslation('capture');
  const [failed, setFailed] = useState(false);
  const uri = photo.uri ?? (fromLab && !failed ? labPhotoUrl(fromLab, photo.id, 'thumb') : null);
  return uri ? (
    <Image
      source={{ uri }}
      style={styles.fill}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <View style={styles.cleared}>
      <Text variant="caption" tone="muted">
        {t('photos.cleared')}
      </Text>
    </View>
  );
}

/** The mark on each photo: its total once labelled, V and the total for values only, or To label. */
function Badge({ photo }: { photo: SessionPhoto }) {
  const { t } = useTranslation('capture');
  const text =
    photo.status === 'unlabelled'
      ? t('photos.toLabel')
      : photo.status === 'values-only'
        ? t('photos.badgeValuesOnly', { total: photo.total ?? 0 })
        : t('photos.badgeLabelled', { total: photo.total ?? 0 });
  const tone =
    photo.status === 'unlabelled' ? 'pending' : photo.status === 'values-only' ? 'info' : 'accent';
  return (
    <View style={styles.badge} accessibilityElementsHidden>
      <Text variant="tab" tone={tone} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  pad: { paddingHorizontal: theme.spacing.l, gap: theme.spacing.xs },
  sub: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
  body: { gap: theme.spacing.m, padding: theme.spacing.l },
  filters: {
    flexDirection: 'row',
    gap: theme.spacing.xxs,
    padding: theme.spacing.xxs,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  filter: {
    flex: 1,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: theme.radii.s,
  },
  // The chosen filter is a filled cell, not an outline.
  filterOn: { backgroundColor: theme.colors.surface2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { borderRadius: theme.radii.s, overflow: 'hidden', backgroundColor: theme.colors.surface },
  fill: { width: '100%', height: '100%' },
  cleared: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    left: 3,
    bottom: 3,
    maxWidth: '94%',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.bg,
  },
  // Above the floating tab bar.
  footer: {
    paddingHorizontal: theme.spacing.l,
    paddingTop: theme.spacing.s,
    paddingBottom: TAB_BAR_SPACE,
  },
  bodyEnd: { height: TAB_BAR_SPACE },
}));
