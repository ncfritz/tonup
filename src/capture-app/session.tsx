import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Linking, useWindowDimensions, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { sessionPhotos, sessionsOn } from '@/features/capture-lab/outbox';
import { fileDrafts, fileOutbox } from '@/features/capture-lab/outboxFiles';
import { prefillFor } from '@/features/capture-lab/queue';
import { TagChips, toggleTag as toggled, type TagKey } from '@/features/capture-lab/SessionBits';
import { cropToSquare } from '@/features/capture-lab/square';
import { useCapture, useLaterNote, useShot } from '@/features/capture-lab/store';
import { LabPill } from '@/features/capture-lab/LabPill';
import { haptics } from '@/services/haptics';
import { Button, Header, Icon, Pressable, Screen, Text } from '@/ui';

/** A session: tags for the conditions, then snap visit after visit. */
export default function CaptureSession() {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [reading, setReading] = useState(false);
  const session = useCapture((s) => s.session);
  const visits = useCapture((s) => s.visits);
  const { width } = useWindowDimensions();
  const laterDraft = useLaterNote((n) => n.draftId);

  // "Saved to label later" shows for a few seconds after Label later, with Undo.
  useEffect(() => {
    if (!laterDraft) return;
    const timer = setTimeout(() => useLaterNote.getState().setNote(null), 5000);
    return () => clearTimeout(timer);
  }, [laterDraft]);
  // The session so far: saved and still to label, and its last photo (read again as visits and
  // drafts come and go).
  const sessionId = session?.id;
  const { saved, toLabel, last } = useMemo(() => {
    void visits;
    void laterDraft;
    if (!sessionId) return { saved: 0, toLabel: 0, last: null };
    try {
      const s = sessionsOn(fileOutbox, fileDrafts).find((x) => x.id === sessionId);
      const photos = sessionPhotos(fileOutbox, fileDrafts, sessionId).filter((p) => p.uri);
      return {
        saved: s?.visits ?? 0,
        toLabel: s?.unlabelled ?? 0,
        last: photos[photos.length - 1]?.uri ?? null,
      };
    } catch {
      return { saved: 0, toLabel: 0, last: null };
    }
  }, [sessionId, visits, laterDraft]);

  const undoLater = () => {
    if (!laterDraft) return;
    fileDrafts.remove(laterDraft);
    useCapture.getState().unsavedVisit();
    useLaterNote.getState().setNote(null);
  };

  const tagText = (k: TagKey) => t(`session.tags.${k}`);
  const toggleTag = (k: TagKey) => {
    if (!session) return;
    useCapture.getState().set({ session: { ...session, tags: toggled(session.tags, k, tagText) } });
  };

  const shoot = async () => {
    if (!camera.current || reading) return;
    setReading(true);
    haptics.light();
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.95, shutterSound: false });
      // The square the viewfinder showed.
      const photo = await cropToSquare(shot.uri);
      useLaterNote.getState().setNote(null);
      useShot.getState().setShot({ photo, detected: await prefillFor(photo) });
      router.push('/label');
    } finally {
      setReading(false);
    }
  };

  const end = () => {
    useCapture.getState().endSession();
    router.back();
  };

  if (!session) return <Redirect href="/" />;
  if (!permission) return <Screen edges={['top', 'bottom']}>{null}</Screen>;
  if (!permission.granted) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header
          title={t('session.title', { n: visits + 1 })}
          backLabel={t('label.back')}
          onBack={() => router.back()}
          right={<LabPill />}
        />
        <Text tone="muted">{t('session.permission')}</Text>
        {permission.canAskAgain ? (
          <Button label={t('session.allow')} onPress={() => void requestPermission()} />
        ) : (
          <Button label={t('session.openSettings')} onPress={() => void Linking.openSettings()} />
        )}
      </Screen>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('label.back')}
          style={styles.round}
          onPress={() => router.back()}
          testID="session-back"
        >
          <Icon name="close" color={theme.colors.text} />
        </Pressable>
        <View style={styles.title}>
          <Text variant="bodyStrong" style={styles.center}>
            {t('session.title', { n: visits + 1 })}
          </Text>
          <View style={styles.countsRow}>
            <Text variant="caption" tone="muted" testID="session-counts">
              {t('session.saved', { count: saved })}
              {toLabel ? (
                <Text variant="caption" tone="pending">
                  {` · ${t('session.toLabel', { count: toLabel })}`}
                </Text>
              ) : null}
            </Text>
            <LabPill />
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('session.end')}
          style={styles.endButton}
          onPress={end}
          testID="session-end"
        >
          <Text variant="caption">{t('session.end')}</Text>
        </Pressable>
      </View>
      <View accessibilityLabel={t('session.tagsA11y')} style={styles.tags}>
        <TagChips on={(k) => session.tags.includes(tagText(k))} onToggle={toggleTag} />
      </View>
      {/* The square viewfinder: exactly what the photo keeps (square.ts). */}
      <View style={{ width, height: width }} testID="session-viewfinder">
        <CameraView ref={camera} style={styles.fill} facing="back" animateShutter={false} />
        <View style={styles.guideWrap} pointerEvents="none">
          <View style={styles.guide} />
        </View>
        {laterDraft ? (
          <View style={styles.note} accessibilityLiveRegion="polite" testID="session-later-note">
            <Text variant="caption" style={styles.noteText}>
              {t('session.laterNote', { count: toLabel })}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.undo}
              onPress={undoLater}
              testID="session-later-undo"
            >
              <Text variant="caption" tone="accent">
                {t('session.undo')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      <View style={styles.bottom}>
        <View style={styles.coach}>
          <Text variant="caption" style={styles.center}>
            {reading ? t('session.reading') : t('session.coach')}
          </Text>
        </View>
        <View style={styles.shutterRow}>
          {/* The session's last photo: opens its photos, with how many are still to label. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('session.photosA11y', { count: toLabel })}
            style={styles.thumb}
            disabled={!saved}
            onPress={() => router.push(`/sessions/${session.id}`)}
            testID="session-photos"
          >
            {last ? <Image source={{ uri: last }} style={styles.thumbImage} /> : null}
            {toLabel ? (
              <View style={styles.badge}>
                <Text variant="tab" tone="onAccent">{`${toLabel}`}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('session.shutter')}
            style={styles.shutter}
            onPress={() => void shoot()}
            disabled={reading}
            testID="session-shutter"
          >
            {reading ? (
              <ActivityIndicator color={theme.colors.text} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
          <View style={styles.thumbSpace} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingTop: 60,
    paddingBottom: 40,
    gap: theme.spacing.s,
  },
  fill: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    paddingHorizontal: theme.spacing.l,
  },
  title: { flex: 1, textAlign: 'center' },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.s,
    marginTop: 2,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  endButton: {
    minHeight: 44,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 22,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  tags: { paddingHorizontal: theme.spacing.l },
  guideWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  // The board should fill about this circle.
  guide: {
    width: '92%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
  },
  note: {
    position: 'absolute',
    top: theme.spacing.s,
    left: theme.spacing.l,
    right: theme.spacing.l,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    paddingLeft: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.pendingSoft,
  },
  noteText: { flex: 1 },
  undo: { minHeight: 44, justifyContent: 'center', paddingHorizontal: theme.spacing.m },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.xxxl,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface,
  },
  thumbImage: { width: '100%', height: '100%', borderRadius: theme.radii.s },
  thumbSpace: { width: 56 },
  badge: {
    position: 'absolute',
    top: -8,
    right: -10,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.pending,
  },
  bottom: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly' },
  coach: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.m,
  },
  center: { textAlign: 'center' },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: theme.colors.text },
}));
