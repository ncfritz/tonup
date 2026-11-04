import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { checkLab, normaliseLabUrl, uploader, type LabHealth } from '@/features/capture-lab/lab';
import { sessionsOn, syncOutbox, type SessionSummary } from '@/features/capture-lab/outbox';
import { modelFiles } from '@/features/capture-lab/modelFiles';
import { fileOutbox } from '@/features/capture-lab/outboxFiles';
import { newSessionId, useCapture } from '@/features/capture-lab/store';
import { Button, Icon, Pressable, Screen, Text } from '@/ui';

/** Capture home: Lab's status, the outbox, sessions on this phone, and starting a session. */
export default function CaptureHome() {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const labUrl = useCapture((s) => s.labUrl);
  const session = useCapture((s) => s.session);
  const visits = useCapture((s) => s.visits);
  const [health, setHealth] = useState<LabHealth | null>(null);
  const [pending, setPending] = useState(0);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    try {
      setPending(fileOutbox.pending().length);
      setSessions(sessionsOn(fileOutbox));
    } catch {
      setPending(0);
      setSessions([]);
    }
  }, []);

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

  // On opening: check Lab, then send anything waiting.
  useFocusEffect(
    useCallback(() => {
      refresh();
      if (!labUrl) {
        setHealth(null);
        return;
      }
      let live = true;
      void checkLab(labUrl).then((h) => {
        if (!live) return;
        setHealth(h);
        if (h.ok && fileOutbox.pending().length) void sync();
      });
      return () => {
        live = false;
      };
    }, [labUrl, refresh, sync]),
  );

  // Lab has a model this phone doesn't: say so, since pre-filling is what speeds labelling up.
  const installedName = (() => {
    try {
      return modelFiles.installed()?.name ?? null;
    } catch {
      return null;
    }
  })();
  const newerModel =
    health?.ok && health.activeModel && health.activeModel !== installedName
      ? health.activeModel
      : null;

  const startSession = () => {
    if (!session) {
      useCapture.getState().startSession({
        id: newSessionId(new Date(), randomUUID()),
        startedAt: new Date().toISOString(),
        tags: [],
      });
    }
    router.push('/session');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text variant="heading" accessibilityRole="header">
            {t('home.title')}
          </Text>
          <Text tone="muted">{t('home.subtitle')}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.settings')}
          style={styles.round}
          onPress={() => router.push('/settings')}
          testID="capture-settings"
        >
          <Icon name="settings" color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card} testID="capture-lab-status">
          {!labUrl ? (
            <>
              <Text variant="bodyStrong">{t('home.labUnset')}</Text>
              <Text variant="caption" tone="muted">
                {t('home.labUnsetBody')}
              </Text>
            </>
          ) : !health ? (
            <Text tone="muted">{t('home.labChecking')}</Text>
          ) : health.ok ? (
            <>
              <View style={styles.row}>
                <View style={[styles.dot, styles.dotOk]} />
                <Text variant="bodyStrong">{t('home.labConnected')}</Text>
              </View>
              <Text variant="caption" tone="muted">
                {t('home.labVersion', { version: health.version, url: normaliseLabUrl(labUrl) })}
              </Text>
              {newerModel ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => router.push('/settings')}
                  testID="capture-model-newer"
                >
                  <Text variant="caption" tone="accent">
                    {t('home.modelNewer', { name: newerModel })}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.row}>
                <View style={[styles.dot, styles.dotDown]} />
                <Text variant="bodyStrong">{t('home.labDown')}</Text>
              </View>
              <Text variant="caption" tone="muted">
                {t('home.labDownBody', { error: health.error })}
              </Text>
            </>
          )}
        </View>

        <View style={[styles.card, styles.row]}>
          <View style={styles.flex}>
            <Text variant="overline" tone="muted">
              {t('home.outbox')}
            </Text>
            <Text variant="title" testID="capture-pending">
              {t('home.waiting', { count: pending })}
            </Text>
            {syncNote ? (
              <Text variant="caption" tone="muted" testID="capture-sync-note">
                {syncNote}
              </Text>
            ) : null}
          </View>
          <View>
            <Button
              kind="secondary"
              label={syncing ? t('home.syncing') : t('home.sync')}
              disabled={!labUrl || syncing || pending === 0}
              onPress={() => void sync()}
              testID="capture-sync"
            />
          </View>
        </View>

        <Text variant="overline" tone="muted">
          {t('home.sessions')}
        </Text>
        {sessions.length === 0 ? (
          <Text tone="muted">{t('home.noSessions')}</Text>
        ) : (
          <View style={styles.list}>
            {sessions.map((s) => (
              <View key={s.id} style={[styles.card, styles.row]} testID={`capture-session-${s.id}`}>
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{new Date(s.startedAt).toLocaleString()}</Text>
                  <Text variant="caption" tone="muted">
                    {t('home.sessionRow', { visits: s.visits, pending: s.pending })}
                    {s.tags.length ? ` · ${s.tags.join(' · ')}` : ''}
                  </Text>
                </View>
                {s.split ? (
                  <View style={styles.chip}>
                    <Text variant="caption" tone="onAccent">
                      {t(`home.split.${s.split}`)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Button
        label={session ? t('home.continue', { count: visits }) : t('home.start')}
        onPress={startSession}
        testID="capture-start"
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  body: { gap: theme.spacing.m, paddingVertical: theme.spacing.m },
  card: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.line,
    borderWidth: 1,
    borderRadius: theme.radii.m,
    padding: theme.spacing.l,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1, gap: theme.spacing.xxs },
  list: { gap: theme.spacing.s },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOk: { backgroundColor: theme.colors.ok },
  dotDown: { backgroundColor: theme.colors.danger },
  chip: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.s,
    paddingHorizontal: theme.spacing.s,
    paddingVertical: theme.spacing.xxs,
  },
}));
