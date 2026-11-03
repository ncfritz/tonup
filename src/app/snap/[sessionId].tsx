import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { boardPointOf } from '@/domain/camera';
import { label, miss } from '@/domain/darts';
import { saveCapture } from '@/features/camera/captures';
import { PhotoMarkup } from '@/features/camera/PhotoMarkup';
import {
  addMiss,
  complete,
  fromDetection,
  labelsOf,
  markStep,
  needsLook,
  proposals,
  remark,
  remove,
  select,
  tap,
  undoMiss,
  type SnapState,
} from '@/features/camera/snap';
import { useGame } from '@/features/game/store';
import { useSettings } from '@/features/settings/store';
import { haptics } from '@/services/haptics';
import { detect } from '@/services/vision';
import { log } from '@/services/diagnostics';
import { Board, Button, Header, Icon, Pressable, Screen, Text } from '@/ui';

/**
 * Snap to score (docs/design/screens.md → Snap to score; ADR 0011): photograph the board after
 * the visit, check what was read (or mark it), fix anything, confirm. Only confirmed darts are
 * recorded, with source `camera` and their board positions.
 */
export default function Snap() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation('game');
  const { theme } = useUnistyles();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [snap, setSnap] = useState<SnapState | null>(null);
  const [reading, setReading] = useState(false);
  const game = useGame((s) => s.game);

  // What's left of this player's visit, fixed when the photo is taken.
  const visits = game ? game.def.visits(game.state) : [];
  const last = visits[visits.length - 1];
  const thrown = last && !last.done ? last.darts.length : 0;
  const left = 3 - thrown;

  const shoot = async () => {
    if (!camera.current || reading) return;
    setReading(true);
    haptics.light();
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: false });
      const photo = { uri: shot.uri, width: shot.width, height: shot.height };
      let detected = null;
      try {
        detected = await detect(shot.uri, photo);
      } catch (e) {
        log('warn', 'snap detection failed', { error: String(e) });
      }
      setSnap(fromDetection(photo, detected, left));
    } finally {
      setReading(false);
    }
  };

  const confirm = () => {
    const g = useGame.getState().game;
    if (!snap || !g || !complete(snap)) return;
    const up = g.def.currentPlayer(g.state);
    const firstSeq = g.darts.length;
    const darts = [
      ...proposals(snap).map((d) => ({ hit: d.hit, point: d.point })),
      ...Array.from({ length: snap.missed }, () => ({ hit: miss(), point: null })),
    ];
    for (const d of darts) {
      const now = useGame.getState().game;
      if (!now) break;
      // Stop if the visit ended early (a checkout or a bust): the rest weren't thrown at this.
      if (now.def.currentPlayer(now.state)?.id !== up?.id) break;
      const vs = now.def.visits(now.state);
      const cur = vs[vs.length - 1];
      if (now.darts.length > firstSeq && (!cur || cur.done)) break;
      useGame.getState().throwDart({
        hit: d.hit,
        point: d.point,
        source: 'camera',
        intended: now.def.targetFor(now.state) ?? undefined,
      });
    }
    saveCapture({
      sessionId,
      firstSeq,
      photoUri: snap.photo.uri,
      width: snap.photo.width,
      height: snap.photo.height,
      detected: snap.detected,
      labels: labelsOf(snap),
      keepPhoto: useSettings.getState().keepPhotos,
      typeId: g.session.typeId,
    });
    haptics.success();
    router.back();
  };

  if (!permission) return <Screen edges={['top', 'bottom']}>{null}</Screen>;

  if (!permission.granted) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={t('snap.title')} backLabel={t('snap.cancel')} onBack={() => router.back()} />
        <Text tone="muted">{t('snap.permission')}</Text>
        {permission.canAskAgain ? (
          <Button
            label={t('snap.allow')}
            onPress={() => void requestPermission()}
            testID="snap-allow"
          />
        ) : (
          <Button label={t('snap.openSettings')} onPress={() => void Linking.openSettings()} />
        )}
      </Screen>
    );
  }

  if (!snap) {
    return (
      <View style={styles.cameraWrap}>
        <CameraView ref={camera} style={styles.camera} facing="back" animateShutter={false} />
        {/* The board guide and coaching sit over the preview. */}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('snap.cancel')}
              style={styles.round}
              onPress={() => router.back()}
              testID="snap-cancel"
            >
              <Icon name="close" color={theme.colors.text} />
            </Pressable>
          </View>
          <View style={styles.guide} pointerEvents="none" />
          <View style={styles.coach}>
            <Text variant="bodyStrong" style={styles.center}>
              {t('snap.coach')}
            </Text>
            <Text variant="caption" tone="muted" style={styles.center}>
              {t('snap.coachTip', { count: left })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('snap.shutter')}
            style={styles.shutter}
            onPress={() => void shoot()}
            disabled={reading}
            testID="snap-shutter"
          >
            {reading ? (
              <ActivityIndicator color={theme.colors.onAccent} />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  const step = markStep(snap);
  const found = proposals(snap);
  const done = complete(snap);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={step ? t('snap.markTitle') : t('snap.reviewTitle')}
        backLabel={t('snap.retake')}
        onBack={() => setSnap(null)}
      />
      {step ? (
        <View style={styles.markRow}>
          <Board
            size={96}
            muted
            markers={[{ point: boardPointOf(step), text: '' }]}
            markerRadius={5}
            accessibilityLabel={t(`snap.mark.${step}`)}
          />
          <View style={styles.flex}>
            {snap.phase.kind === 'mark' && snap.phase.failed ? (
              <Text tone="danger">{t('snap.markFailed')}</Text>
            ) : null}
            <Text variant="bodyStrong" testID="snap-step">
              {t(`snap.mark.${step}`)}
            </Text>
            <Text variant="caption" tone="muted">
              {snap.board === 'manual' && !snap.detected?.modelVersion
                ? t('snap.noModel')
                : t('snap.notFound')}
            </Text>
          </View>
        </View>
      ) : (
        <Text tone="muted" testID="snap-hint">
          {done
            ? t('snap.reviewDone')
            : t('snap.reviewTap', { count: snap.expected - snap.darts.length - snap.missed })}
        </Text>
      )}
      <PhotoMarkup
        state={snap}
        darts={found}
        onTap={(p) => {
          haptics.light();
          setSnap(tap(snap, p));
        }}
        onSelect={(i) => setSnap(select(snap, i))}
      />
      {step ? null : (
        <>
          <View style={styles.list}>
            {found.map((d, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityState={{ selected: snap.selected === i }}
                accessibilityLabel={t('snap.dartA11y', {
                  n: i + 1,
                  dart: label(d.hit),
                  score: d.hit.score,
                })}
                style={[styles.dart, snap.selected === i && styles.dartOn]}
                onPress={() => setSnap(select(snap, i))}
                testID={`snap-dart-${i}`}
              >
                <Text variant="value">{`${i + 1}`}</Text>
                <Text variant="title" style={styles.flex}>
                  {label(d.hit)}
                </Text>
                {needsLook(d) ? (
                  <Text variant="caption" tone="danger">
                    {d.nearWire ? t('snap.onWire') : t('snap.unsure')}
                  </Text>
                ) : null}
                <Text variant="value" tone="accent">
                  {d.hit.score}
                </Text>
              </Pressable>
            ))}
            {Array.from({ length: snap.missed }, (_, i) => (
              <View key={`m${i}`} style={styles.dart}>
                <Text variant="value">{`${found.length + i + 1}`}</Text>
                <Text variant="title" style={styles.flex}>
                  {t('snap.missed')}
                </Text>
                <Pressable accessibilityRole="button" onPress={() => setSnap(undoMiss(snap))}>
                  <Text variant="caption" tone="accent">
                    {t('snap.undoMiss')}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
          {snap.selected !== null ? (
            <Text variant="caption" tone="muted">
              {t('snap.moveHint')}
            </Text>
          ) : null}
          <View style={styles.row}>
            {snap.selected !== null ? (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('snap.remove')}
                  onPress={() => setSnap(remove(snap, snap.selected!))}
                  testID="snap-remove"
                />
              </View>
            ) : null}
            {!done ? (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('snap.addMiss')}
                  onPress={() => setSnap(addMiss(snap))}
                  testID="snap-miss"
                />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('snap.remark')}
                onPress={() => setSnap(remark(snap))}
                testID="snap-remark"
              />
            </View>
          </View>
          <Button
            label={t('snap.confirm', { total: found.reduce((n, d) => n + d.hit.score, 0) })}
            onPress={confirm}
            disabled={!done}
            testID="snap-confirm"
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  cameraWrap: { flex: 1, backgroundColor: theme.colors.bg },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 48,
    paddingHorizontal: theme.spacing.l,
  },
  topBar: { alignSelf: 'stretch', flexDirection: 'row' },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  // The board should fill about this circle.
  guide: {
    width: '86%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
  },
  coach: {
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: theme.colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.text },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  list: { gap: theme.spacing.xs },
  dart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    minHeight: 48,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  dartOn: { borderWidth: 2, borderColor: theme.colors.accent },
  row: { flexDirection: 'row', gap: theme.spacing.s },
}));
