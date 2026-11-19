import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { fitBoard } from '@/domain/camera';
import { PhotoMarkup, type MarkupDart } from '@/features/camera/PhotoMarkup';
import { labPhotoUrl } from '@/features/capture-lab/lab';
import { LabPill, useLabState } from '@/features/capture-lab/LabPill';
import { sessionPhotos } from '@/features/capture-lab/outbox';
import { fileDrafts, fileOutbox } from '@/features/capture-lab/outboxFiles';
import { addTips } from '@/features/capture-lab/queue';
import { calibrationOf, sketchTips } from '@/features/capture-lab/sketch';
import { useCapture } from '@/features/capture-lab/store';
import { visitTotal } from '@/features/capture-lab/visit';
import { ZoomPan } from '@/features/capture-lab/ZoomPan';
import { Board, Button, Icon, Pressable, SegmentedControl, Text } from '@/ui';

type Shown = 'photo' | 'board';

/**
 * A saved visit, full size (docs/plan/capture-lab.md › Photos and the full-size view): the photo
 * with its board and numbered tips, or the visit drawn square on; its values and total; the
 * session's other visits a tap away. With the photo gone from the phone, Lab's copy shows when Lab
 * has it; without that, the visit is drawn from its label, square on (or as shot, the board where
 * it sat in the frame).
 */
export default function SavedPhoto() {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
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

  // The session's saved visits, for "Photo n of N" and the arrows. Label later photos aren't
  // here: tapping one starts labelling it.
  const siblings = useMemo(() => {
    if (!label) return [];
    try {
      return sessionPhotos(fileOutbox, fileDrafts, label.sessionId).filter(
        (p) => p.status === 'labelled' || p.status === 'values-only',
      );
    } catch {
      return [];
    }
  }, [label]);
  const at = siblings.findIndex((p) => p.id === id);
  const go = (to: number) => {
    const next = siblings[to];
    if (next) router.setParams({ id: next.id });
  };

  const calibration = useMemo(() => (label ? calibrationOf(label) : {}), [label]);
  const fit = useMemo(() => fitBoard(calibration), [calibration]);
  const tips = useMemo(() => (label ? sketchTips(label) : null), [label]);
  const darts: MarkupDart[] = (label?.darts ?? []).flatMap((d, i) =>
    d.x !== null && d.y !== null
      ? [{ image: { x: d.x, y: d.y }, n: i + 1, flagged: !!d.onWire }]
      : [],
  );
  const values = (label?.darts ?? []).map((d) => d.value);

  // The photo: the phone's while it has it; once cleared, Lab's (when Lab's up and has it); else
  // the markup on a blank, which the label alone is enough to draw.
  const labUrl = useCapture((s) => s.labUrl);
  const labOk = useLabState() === 'ok';
  // Per visit: the arrows move to another one.
  const [failedId, setFailedId] = useState<string | null>(null);
  const labFailed = failedId === id;
  const source: 'phone' | 'lab' | 'blank' = found?.uri
    ? 'phone'
    : found?.sent && labOk && !labFailed
      ? 'lab'
      : 'blank';
  const uri = source === 'phone' ? found!.uri : source === 'lab' ? labPhotoUrl(labUrl, id) : null;

  // With a photo to show, it opens on the photo; drawn from the label, square on.
  const [picked, setPicked] = useState<{ id: string; view: Shown } | null>(null);
  const view: Shown =
    picked?.id === id ? picked.view : source === 'blank' && tips ? 'board' : 'photo';
  const [marks, setMarks] = useState(true);
  const [area, setArea] = useState({ w: 0, h: 0 });
  const onArea = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const boardSize = Math.floor(Math.max(0, Math.min(area.w, area.h)));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewer.close')}
          onPress={() => router.back()}
          style={styles.round}
          testID="viewer-close"
        >
          <Icon name="close" color={theme.colors.text} size={20} strokeWidth={2.2} />
        </Pressable>
        <Text variant="bodyStrong" style={styles.title} testID="viewer-count">
          {at >= 0 ? t('viewer.count', { n: at + 1, count: siblings.length }) : t('saved.title')}
        </Text>
        <LabPill />
      </View>

      {label ? (
        <>
          <View style={styles.pad}>
            <SegmentedControl<Shown>
              accessibilityLabel={t('viewer.view')}
              value={view}
              onChange={(v) => setPicked({ id, view: v })}
              segments={[
                {
                  value: 'photo',
                  label: source === 'blank' ? t('viewer.asShot') : t('viewer.photo'),
                },
                { value: 'board', label: t('viewer.board') },
              ]}
            />
            {source !== 'phone' ? (
              <View style={styles.sourceRow}>
                {source === 'blank' ? (
                  <Icon name="noPhoto" color={theme.colors.muted} size={14} strokeWidth={2.2} />
                ) : null}
                <Text variant="caption" tone="muted" style={styles.flex} testID="saved-source">
                  {source === 'lab' ? t('saved.fromLab') : t('saved.blank')}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.stage} onLayout={onArea}>
            {view === 'photo' ? (
              <ZoomPan key={`${id}-photo`} onZoom={setScale} testID="saved-zoom">
                <PhotoMarkup
                  photo={{ uri, width: label.width, height: label.height }}
                  onPhotoError={() => setFailedId(id)}
                  fit={marks || !uri ? fit : null}
                  calibration={marks || !uri ? calibration : {}}
                  darts={marks || !uri ? darts : []}
                  selected={null}
                  selectNear={false}
                  scale={scale}
                  onTap={() => {}}
                  onSelect={() => {}}
                />
              </ZoomPan>
            ) : tips ? (
              boardSize > 0 ? (
                <ZoomPan key={`${id}-board`} testID="viewer-board">
                  <View style={[styles.boardBox, { width: area.w, height: area.h }]}>
                    <Board
                      size={boardSize}
                      markers={tips.map((d) => ({ point: d.point, text: String(d.n) }))}
                      accessibilityLabel={t('viewer.boardA11y')}
                    />
                  </View>
                </ZoomPan>
              ) : null
            ) : (
              <View style={styles.boardBox}>
                <Text tone="muted" style={styles.pad}>
                  {t('viewer.noBoard')}
                </Text>
              </View>
            )}
            {at > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('viewer.previous')}
                onPress={() => go(at - 1)}
                style={[styles.round, styles.arrow, styles.left]}
                testID="viewer-previous"
              >
                <Icon name="back" color={theme.colors.text} size={20} strokeWidth={2.2} />
              </Pressable>
            ) : null}
            {at >= 0 && at < siblings.length - 1 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('viewer.next')}
                onPress={() => go(at + 1)}
                style={[styles.round, styles.arrow, styles.right]}
                testID="viewer-next"
              >
                <Icon name="chevron" color={theme.colors.text} size={20} strokeWidth={2.2} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.info}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="title" testID="viewer-values">
                  {values.join(' · ')}
                </Text>
                <Text variant="caption" tone="muted">
                  {[
                    label.valuesOnly ? t('photos.valuesOnly') : t('photos.labelled'),
                    found?.sent ? t('saved.inLab') : t('saved.waiting'),
                    t('viewer.hint'),
                  ].join(' · ')}
                </Text>
              </View>
              <Text variant="score" testID="saved-total">{`${visitTotal(values)}`}</Text>
            </View>
            {view === 'board' && tips && !tips.length ? (
              <Text variant="caption" tone="muted">
                {t('viewer.noTips')}
              </Text>
            ) : null}
            {view === 'photo' && uri ? (
              <View style={styles.row}>
                <Text style={styles.flex}>{t('viewer.marks')}</Text>
                <Switch
                  value={marks}
                  onValueChange={setMarks}
                  accessibilityLabel={t('viewer.marks')}
                  trackColor={{ true: theme.colors.accent, false: theme.colors.surface2 }}
                  testID="viewer-marks"
                />
              </View>
            ) : null}
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
        </>
      ) : (
        <View style={[styles.pad, styles.flex]}>
          <Text tone="muted">{t('saved.missing')}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    paddingHorizontal: theme.spacing.s,
    paddingBottom: theme.spacing.s,
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
  pad: { paddingHorizontal: theme.spacing.l, gap: theme.spacing.xs },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
  stage: { flex: 1, marginTop: theme.spacing.s },
  boardBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  arrow: { position: 'absolute', top: '50%', marginTop: -22, opacity: 0.85 },
  left: { left: theme.spacing.xs },
  right: { right: theme.spacing.xs },
  info: { gap: theme.spacing.m, padding: theme.spacing.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
}));
