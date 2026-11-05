import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { CALIBRATION_IDS, fitBoard, type CalibrationId, type ImagePoint } from '@/domain/camera';
import { PhotoMarkup, type MarkupDart } from '@/features/camera/PhotoMarkup';
import { fileOutbox } from '@/features/capture-lab/outboxFiles';
import { addTips } from '@/features/capture-lab/queue';
import { visitTotal } from '@/features/capture-lab/visit';
import { ZoomPan } from '@/features/capture-lab/ZoomPan';
import { Button, Header, Text } from '@/ui';

/** A visit as it was saved: the photo with its board and numbered tips, its values and total. */
export default function SavedPhoto() {
  const { t } = useTranslation('capture');
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scale, setScale] = useState(1);
  const found = useMemo(() => {
    try {
      const pending = fileOutbox.pending().find((i) => i.id === id);
      if (pending) return { item: pending, uri: fileOutbox.photoUri(id), sent: false };
      const sent = fileOutbox.sent().find((i) => i.id === id);
      return sent ? { item: sent, uri: fileOutbox.sentPhotoUri(id), sent: true } : null;
    } catch {
      return null;
    }
  }, [id]);

  const label = found?.item.label;
  const calibration = useMemo(() => {
    const c: Partial<Record<CalibrationId, ImagePoint>> = {};
    CALIBRATION_IDS.forEach((k, i) => {
      const p = label?.calibration[i];
      if (p) c[k] = p;
    });
    return c;
  }, [label]);
  const fit = useMemo(() => fitBoard(calibration), [calibration]);
  const darts: MarkupDart[] = (label?.darts ?? []).flatMap((d, i) =>
    d.x !== null && d.y !== null
      ? [{ image: { x: d.x, y: d.y }, n: i + 1, flagged: !!d.onWire }]
      : [],
  );
  const values = (label?.darts ?? []).map((d) => d.value);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.pad}>
        <Header
          title={t('saved.title')}
          backLabel={t('photos.back')}
          onBack={() => router.back()}
        />
      </View>
      {label && found?.uri ? (
        <ZoomPan onZoom={setScale} testID="saved-zoom">
          <PhotoMarkup
            photo={{ uri: found.uri, width: label.width, height: label.height }}
            fit={fit}
            calibration={calibration}
            darts={darts}
            selected={null}
            selectNear={false}
            scale={scale}
            onTap={() => {}}
            onSelect={() => {}}
          />
        </ZoomPan>
      ) : (
        <View style={[styles.pad, styles.fill]}>
          <Text tone="muted">{label ? t('saved.cleared') : t('saved.missing')}</Text>
        </View>
      )}
      {label ? (
        <View style={styles.info}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Text variant="overline" tone="muted">
                {t('label.total')}
              </Text>
              <Text variant="score" testID="saved-total">{`${visitTotal(values)}`}</Text>
            </View>
            <View style={styles.right}>
              <Text variant="title">{values.join(' · ')}</Text>
              <Text variant="caption" tone="muted">
                {[
                  label.valuesOnly ? t('photos.valuesOnly') : t('photos.labelled'),
                  found?.sent ? t('saved.inLab') : t('saved.waiting'),
                ].join(' · ')}
              </Text>
            </View>
          </View>
          {label.valuesOnly && found?.uri ? (
            <Button
              label={t('saved.addTips')}
              onPress={() => addTips(label.id)}
              testID="saved-add-tips"
            />
          ) : (
            <Text variant="caption" tone="muted">
              {t('saved.editInLab')}
            </Text>
          )}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  pad: { paddingHorizontal: theme.spacing.l },
  fill: { flex: 1 },
  info: { gap: theme.spacing.m, padding: theme.spacing.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
}));
