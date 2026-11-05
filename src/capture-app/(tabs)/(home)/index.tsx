import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { uploader } from '@/features/capture-lab/lab';
import { recheckLab, useLabHealth } from '@/features/capture-lab/labHealth';
import {
  labelQueue,
  sessionsOn,
  syncOutbox,
  type SessionSummary,
} from '@/features/capture-lab/outbox';
import { fileDrafts, fileOutbox } from '@/features/capture-lab/outboxFiles';
import { startLabelling } from '@/features/capture-lab/queue';
import {
  sessionWhen,
  SplitChip,
  StatusBar,
  StatusLine,
  TagChips,
  toggleTag,
  type TagKey,
} from '@/features/capture-lab/SessionBits';
import { newSessionId, useCapture } from '@/features/capture-lab/store';
import { Button, Pressable, Screen, Text } from '@/ui';

const EMPTY = { labelled: 0, valuesOnly: 0, unlabelled: 0, visits: 0 };

/**
 * Sessions, Capture's home (docs/plan/capture-lab.md › Screens): Lab's status, the session
 * being shot or a new one, totals, and past sessions with what's labelled and what's left.
 */
export default function CaptureHome() {
  const { t } = useTranslation('capture');
  const labUrl = useCapture((s) => s.labUrl);
  const session = useCapture((s) => s.session);
  const [pending, setPending] = useState(0);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  const refresh = useCallback(() => {
    try {
      setPending(fileOutbox.pending().length);
      setSessions(sessionsOn(fileOutbox, fileDrafts));
    } catch {
      setPending(0);
      setSessions([]);
    }
  }, []);

  const health = useLabHealth((s) => (s.url === labUrl ? s.health : null));
  const sync = useCallback(async () => {
    if (!labUrl) return;
    setSyncing(true);
    setSyncNote(null);
    const r = await syncOutbox(fileOutbox, uploader(labUrl));
    setSyncing(false);
    const notes: string[] = [];
    if (r.sent) notes.push(t('home.synced', { sent: r.sent }));
    if (r.rejected.length) {
      notes.push(t('home.syncRejected', { count: r.rejected.length, error: r.rejected[0]!.error }));
    }
    if (r.offline) notes.push(t('home.syncOffline', { error: r.offline }));
    setSyncNote(notes.join(' · ') || null);
    refresh();
  }, [labUrl, refresh, t]);

  // On opening (and back from labelling): check Lab, then send anything waiting.
  useFocusEffect(
    useCallback(() => {
      refresh();
      if (!labUrl) return;
      let live = true;
      void recheckLab(labUrl).then((h) => {
        if (live && h.ok && fileOutbox.pending().length) void sync();
      });
      return () => {
        live = false;
      };
    }, [labUrl, refresh, sync]),
  );

  const current = session
    ? (sessions.find((s) => s.id === session.id) ?? { ...EMPTY, id: session.id })
    : null;
  const past = sessions.filter((s) => s.id !== session?.id);
  const pastToLabel = past.reduce((n, s) => n + s.unlabelled, 0);
  const totals = sessions.reduce(
    (a, s) => ({
      visits: a.visits + s.visits,
      labelled: a.labelled + s.labelled,
      valuesOnly: a.valuesOnly + s.valuesOnly,
      unlabelled: a.unlabelled + s.unlabelled,
    }),
    EMPTY,
  );
  const tagText = (k: TagKey) => t(`session.tags.${k}`);

  const startSession = () => {
    useCapture.getState().startSession({
      id: newSessionId(new Date(), randomUUID()),
      startedAt: new Date().toISOString(),
      tags,
    });
    router.push('/session');
  };
  const endSession = () => {
    useCapture.getState().endSession();
    setTags([]);
    refresh();
  };

  return (
    <Screen scroll>
      <View>
        <Text variant="heading" accessibilityRole="header">
          {t('home.title')}
        </Text>
        <Text tone="muted">{t('home.subtitle')}</Text>
      </View>

      <View style={styles.status} testID="capture-lab-status">
        <View
          style={[
            styles.dot,
            health?.ok ? styles.dotOk : health && !health.ok ? styles.dotDown : styles.dotIdle,
          ]}
        />
        <View style={styles.flex}>
          {!labUrl ? (
            <Text variant="caption" tone="muted">
              {t('home.labSettings')}
            </Text>
          ) : !health ? (
            <Text variant="caption" tone="muted">
              {t('home.labChecking')}
            </Text>
          ) : health.ok ? (
            <Text variant="caption">
              {t('home.labConnected')}
              <Text variant="caption" tone="muted">
                {` · ${health.activeModel ? t('home.modelOn', { name: health.activeModel }) : t('home.modelNoneShort')} · `}
              </Text>
              <Text variant="caption" tone="muted" testID="capture-pending">
                {t('home.waitingShort', { count: pending })}
              </Text>
            </Text>
          ) : (
            <Text variant="caption">
              {t('home.labDown')}
              <Text variant="caption" tone="muted">{` · ${health.error}`}</Text>
            </Text>
          )}
          {syncNote ? (
            <Text variant="caption" tone="muted" testID="capture-sync-note">
              {syncNote}
            </Text>
          ) : null}
        </View>
        {labUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: syncing || pending === 0 }}
            disabled={syncing || pending === 0}
            style={[styles.sync, (syncing || pending === 0) && styles.dim]}
            onPress={() => void sync()}
            testID="capture-sync"
          >
            <Text variant="caption" tone="accent">
              {syncing ? t('home.syncing') : t('home.sync')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {current && session ? (
        <View style={[styles.card, styles.cardOn]} testID="capture-current">
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="overline" tone="accent">
                {t('home.current')}
              </Text>
              <Text variant="title">{sessionWhen(session.startedAt)}</Text>
              <Text variant="caption" tone="muted">
                {[t('home.photos', { count: current.visits }), ...session.tags].join(' · ')}
              </Text>
            </View>
            <SplitChip split={'split' in current ? current.split : undefined} />
          </View>
          <StatusBar counts={current} thick />
          <View style={styles.counts}>
            <Count n={current.labelled} label={t('home.totalLabelled')} />
            <Count n={current.valuesOnly} label={t('photos.valuesOnly')} />
            <Count n={current.unlabelled} label={t('home.totalToLabel')} pending />
          </View>
          <View style={styles.row}>
            <View style={styles.flexWide}>
              <Button
                label={t('home.keepSnapping')}
                onPress={() => router.push('/session')}
                testID="capture-start"
              />
            </View>
            {current.unlabelled ? (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('home.labelN', { count: current.unlabelled })}
                  onPress={() =>
                    void startLabelling(labelQueue(fileDrafts, { session: session.id }))
                  }
                  testID="capture-label-current"
                />
              </View>
            ) : null}
          </View>
          <View style={styles.links}>
            {current.visits ? (
              <Pressable
                accessibilityRole="link"
                style={styles.link}
                onPress={() => router.push(`/sessions/${session.id}`)}
                testID="capture-current-photos"
              >
                <Text variant="caption" tone="accent">
                  {t('home.seePhotos')}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              style={styles.link}
              onPress={endSession}
              testID="capture-end"
            >
              <Text variant="caption" tone="accent">
                {t('home.endSession')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.card} testID="capture-new">
          <Text variant="title">{t('home.newSession')}</Text>
          <Text variant="caption" tone="muted">
            {t('home.newSessionNote')}
          </Text>
          <TagChips
            tone="surface2"
            testID="home-tag"
            on={(k) => tags.includes(tagText(k))}
            onToggle={(k) => setTags(toggleTag(tags, k, tagText))}
          />
          <Button label={t('home.start')} onPress={startSession} testID="capture-start" />
        </View>
      )}

      {sessions.length ? (
        <View style={styles.strip} testID="capture-totals">
          <Count n={totals.visits} label={t('home.totalPhotos')} />
          <Count
            n={
              totals.visits
                ? Math.round(((totals.labelled + totals.valuesOnly) / totals.visits) * 100)
                : 0
            }
            suffix="%"
            label={t('home.totalLabelled')}
          />
          <Count n={totals.unlabelled} label={t('home.totalToLabel')} pending />
          <Count n={sessions.length} label={t('home.totalSessions')} />
        </View>
      ) : null}

      <View style={styles.row}>
        <Text variant="overline" tone="muted" style={styles.flex}>
          {t('home.past')}
        </Text>
        {pastToLabel ? (
          <Pressable
            accessibilityRole="button"
            style={styles.link}
            onPress={() =>
              void startLabelling(labelQueue(fileDrafts, { except: session?.id ?? null }))
            }
            testID="capture-label-all"
          >
            <Text variant="caption" tone="accent">
              {t('home.labelAll', { count: pastToLabel })}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {past.length === 0 ? (
        <Text tone="muted">{t('home.noSessions')}</Text>
      ) : (
        <View style={styles.list}>
          {past.map((s, i) => (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              accessibilityLabel={t('home.sessionA11y', {
                when: sessionWhen(s.startedAt),
                count: s.visits,
              })}
              style={[styles.sessionRow, i > 0 && styles.divider]}
              onPress={() => router.push(`/sessions/${s.id}`)}
              testID={`capture-session-${s.id}`}
            >
              <View style={styles.row}>
                <Text variant="bodyStrong" style={styles.flex}>
                  {sessionWhen(s.startedAt)}
                </Text>
                <SplitChip split={s.split} />
              </View>
              <Text variant="caption" tone="muted">
                {[t('home.photos', { count: s.visits }), ...s.tags].join(' · ')}
              </Text>
              <StatusBar counts={s} />
              <StatusLine counts={s} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Count({
  n,
  label,
  suffix = '',
  pending = false,
}: {
  n: number;
  label: string;
  suffix?: string;
  pending?: boolean;
}) {
  return (
    <View style={styles.count}>
      <Text variant="value" tone={pending && n ? 'pending' : 'text'}>{`${n}${suffix}`}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: theme.colors.ok },
  dotDown: { backgroundColor: theme.colors.danger },
  dotIdle: { backgroundColor: theme.colors.muted },
  sync: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.m },
  dim: { opacity: 0.4 },
  card: {
    gap: theme.spacing.m,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  // The session being shot stands out by its fill.
  cardOn: { backgroundColor: theme.colors.accentSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1, gap: theme.spacing.xxs },
  flexWide: { flex: 1.4 },
  counts: { flexDirection: 'row', gap: theme.spacing.s },
  count: { flex: 1, gap: 0 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.l },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.xs },
  strip: {
    flexDirection: 'row',
    gap: theme.spacing.s,
    paddingVertical: theme.spacing.m,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  list: { borderRadius: theme.radii.l, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  sessionRow: { gap: theme.spacing.xs, padding: theme.spacing.l },
  divider: { borderTopWidth: 1, borderTopColor: theme.colors.line },
}));
