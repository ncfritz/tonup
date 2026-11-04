import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useCapture, useShot } from '@/features/capture-lab/store';
import { log } from '@/services/diagnostics';
import { haptics } from '@/services/haptics';
import { detect } from '@/services/vision';
import { Button, Header, Icon, Pressable, Screen, Text } from '@/ui';

// Quick tags, one from each group (docs/plan/capture-lab.md › Screens › Session).
const TAG_GROUPS = [
  ['lightOn', 'lightOff', 'daylight'],
  ['left', 'centre', 'right'],
] as const;
type TagKey = (typeof TAG_GROUPS)[number][number];

/** A session: tags for the conditions, then snap visit after visit. */
export default function CaptureSession() {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [reading, setReading] = useState(false);
  const session = useCapture((s) => s.session);
  const visits = useCapture((s) => s.visits);
  const prefill = useCapture((s) => s.prefill);

  const tagText = (k: TagKey) => t(`session.tags.${k}`);
  const toggleTag = (k: TagKey) => {
    if (!session) return;
    const group = TAG_GROUPS.find((g) => (g as readonly TagKey[]).includes(k))!;
    const others = (group as readonly TagKey[]).filter((g) => g !== k).map(tagText);
    const on = session.tags.includes(tagText(k));
    const tags = session.tags.filter((x) => !others.includes(x) && x !== tagText(k));
    useCapture.getState().set({ session: { ...session, tags: on ? tags : [...tags, tagText(k)] } });
  };

  const shoot = async () => {
    if (!camera.current || reading) return;
    setReading(true);
    haptics.light();
    try {
      const shot = await camera.current.takePictureAsync({ quality: 0.92, shutterSound: false });
      const photo = { uri: shot.uri, width: shot.width, height: shot.height };
      let detected = null;
      if (prefill) {
        try {
          const d = await detect(shot.uri, photo);
          detected = d.modelVersion ? d : null;
        } catch (e) {
          log('warn', 'capture detection failed', { error: String(e) });
        }
      }
      useShot.getState().setShot({ photo, detected });
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
      <CameraView ref={camera} style={styles.camera} facing="back" animateShutter={false} />
      <View style={styles.overlay} pointerEvents="box-none">
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
          <Text variant="bodyStrong" style={styles.title}>
            {t('session.title', { n: visits + 1 })}
          </Text>
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
          {TAG_GROUPS.flat().map((k) => {
            const on = session.tags.includes(tagText(k));
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.tag, on && styles.tagOn]}
                onPress={() => toggleTag(k)}
                testID={`tag-${k}`}
              >
                <Text variant="caption" tone={on ? 'onAccent' : 'text'}>
                  {tagText(k)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.guide} pointerEvents="none" />
        <View style={styles.coach}>
          <Text variant="caption" style={styles.center}>
            {reading ? t('session.reading') : t('session.coach')}
          </Text>
        </View>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flex: 1, backgroundColor: theme.colors.bg },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: theme.spacing.l,
    gap: theme.spacing.s,
  },
  topBar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
  },
  title: { flex: 1, textAlign: 'center' },
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
  tags: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  tag: {
    minHeight: 32,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  tagOn: { backgroundColor: theme.colors.accent },
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
