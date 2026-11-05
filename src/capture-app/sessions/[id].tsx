import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, useWindowDimensions, View } from 'react-native';
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
import { startLabelling } from '@/features/capture-lab/queue';
import { RunDone, sessionWhen, SplitChip, StatusBar } from '@/features/capture-lab/SessionBits';
import { Button, Header, Pressable, Text } from '@/ui';

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

  useFocusEffect(
    useCallback(() => {
      try {
        setSummary(sessionsOn(fileOutbox, fileDrafts).find((s) => s.id === id) ?? null);
        setPhotos(sessionPhotos(fileOutbox, fileDrafts, id));
      } catch {
        setPhotos([]);
      }
    }, [id]),
  );

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
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.pad}>
        <Header
          title={summary ? sessionWhen(summary.startedAt) : ''}
          backLabel={t('photos.back')}
          onBack={() => router.back()}
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
        <RunDone />
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
                  accessibilityRole={p.status === 'unlabelled' ? 'button' : 'image'}
                  accessibilityLabel={label}
                  disabled={p.status !== 'unlabelled'}
                  style={[styles.tile, { width: tile, height: tile }]}
                  onPress={() => void startLabelling(queue(), p.id)}
                  testID={`photo-${p.id}`}
                >
                  {p.uri ? (
                    <Image source={{ uri: p.uri }} style={styles.fill} resizeMode="cover" />
                  ) : (
                    <View style={styles.cleared}>
                      <Text variant="caption" tone="muted">
                        {t('photos.cleared')}
                      </Text>
                    </View>
                  )}
                  <Badge photo={p} />
                </Pressable>
              );
            })}
          </View>
        )}
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
  footer: { paddingHorizontal: theme.spacing.l, paddingTop: theme.spacing.s },
}));
