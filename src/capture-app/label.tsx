import { randomUUID } from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { boardPointOf } from '@/domain/camera';
import { label as labelOf } from '@/domain/darts';
import { PhotoMarkup, type MarkupDart } from '@/features/camera/PhotoMarkup';
import { uploader } from '@/features/capture-lab/lab';
import { syncOutbox } from '@/features/capture-lab/outbox';
import { fileOutbox } from '@/features/capture-lab/outboxFiles';
import { useCapture, useShot } from '@/features/capture-lab/store';
import {
  back,
  BOUNCE_OUT,
  canLeaveValues,
  canReview,
  checks,
  enter,
  labelFile,
  markingPoint,
  MISS,
  remark,
  selectDart,
  start,
  tapBoard,
  tapTip,
  toBoard,
  toggleWire,
  toReview,
  toTips,
  undoEnter,
  visitTotal,
  type Step,
  type VisitState,
} from '@/features/capture-lab/visit';
import { ZoomPan } from '@/features/capture-lab/ZoomPan';
import { log } from '@/services/diagnostics';
import { haptics } from '@/services/haptics';
import { Board, Button, DartSlots, Icon, Keypad, Pressable, Text } from '@/ui';

const STEPS: Step[] = ['values', 'board', 'tips', 'review'];

/**
 * Labelling one visit (docs/plan/capture-lab.md › Screens): what the darts scored, the board,
 * each tip, then review. Every tip has to score its value, or be flagged on the wire. Each step
 * fits the screen: the photo edge to edge (zoomable), its buttons pinned at the bottom.
 */
export default function LabelVisit() {
  const shot = useShot((s) => s.shot);
  if (!shot) return <Redirect href="/session" />;
  return <Labeller initial={start(shot.photo, shot.detected)} />;
}

/** One step's frame: a compact top bar, the step's content, its buttons at the bottom. */
function StepFrame({
  title,
  step,
  backLabel,
  onBack,
  children,
  footer,
}: {
  title: string;
  step: Step;
  backLabel: string;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backLabel}
          style={styles.backButton}
          onPress={onBack}
          testID="label-back"
        >
          <View style={styles.flip}>
            <Icon name="chevron" color={theme.colors.text} />
          </View>
          <Text variant="caption">{backLabel}</Text>
        </Pressable>
        <Text variant="bodyStrong" style={styles.topTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text variant="caption" tone="muted" style={styles.stepCount}>
          {t('label.step', { n: STEPS.indexOf(step) + 1 })}
        </Text>
      </View>
      <View style={styles.body}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

function Labeller({ initial }: { initial: VisitState }) {
  const { t } = useTranslation('capture');
  const { t: tg } = useTranslation('game');
  const [s, setVisit] = useState(initial);
  const [scale, setScale] = useState(1);
  const list = checks(s);

  // A new step starts with the whole photo in view.
  const setS = (next: VisitState) => {
    if (next.step !== s.step) setScale(1);
    setVisit(next);
  };

  const retake = () => {
    useShot.getState().setShot(null);
    router.back();
  };
  const onBack = () => (s.step === 'values' ? retake() : setS(back(s)));
  const backLabel = s.step === 'values' ? t('label.retake') : t('label.back');

  const save = (valuesOnly: boolean) => {
    const { session, labUrl } = useCapture.getState();
    if (!session) return;
    const id = randomUUID();
    const file = labelFile(s, { id, createdAt: new Date().toISOString(), session }, valuesOnly);
    try {
      fileOutbox.put(file, s.photo.uri);
    } catch (e) {
      log('error', 'capture: saving to the outbox failed', { error: String(e) });
      return;
    }
    haptics.success();
    useCapture.getState().savedVisit();
    useShot.getState().setShot(null);
    // Send it now if Lab is there; it waits in the outbox if not.
    if (labUrl) void syncOutbox(fileOutbox, uploader(labUrl)).catch(() => {});
    router.back();
  };

  const photoMarkup = (onTap: ((p: { x: number; y: number }) => void) | null) => {
    const darts: MarkupDart[] = [];
    const indexOf: number[] = [];
    list.forEach((c, i) => {
      if (!c.tip || s.step === 'board') return;
      darts.push({ image: c.tip, n: i + 1, flagged: !c.ok });
      indexOf.push(i);
    });
    const selected = s.selected === null ? null : indexOf.indexOf(s.selected);
    return (
      <ZoomPan key={s.step} onZoom={setScale} testID="label-zoom">
        <PhotoMarkup
          photo={s.photo}
          fit={s.fit}
          calibration={s.calibration}
          darts={darts}
          selected={selected !== null && selected >= 0 ? selected : null}
          selectNear={s.step === 'tips'}
          scale={scale}
          onTap={(p) => {
            if (!onTap) return;
            haptics.light();
            onTap(p);
          }}
          onSelect={(k) => setS(selectDart(s, indexOf[k] ?? null))}
        />
      </ZoomPan>
    );
  };

  if (s.step === 'values') {
    const full = s.entered.length >= 3;
    return (
      <StepFrame
        title={t('label.valuesTitle')}
        step={s.step}
        backLabel={backLabel}
        onBack={onBack}
        footer={
          <Button
            label={t('label.toBoard')}
            onPress={() => setS(toBoard(s))}
            disabled={!canLeaveValues(s)}
            testID="to-board"
          />
        }
      >
        <View style={styles.values}>
          <View style={styles.row}>
            <Image source={{ uri: s.photo.uri }} style={styles.thumb} resizeMode="cover" />
            <View style={styles.flex}>
              <Text variant="caption" tone="muted">
                {t('label.valuesHint')}
              </Text>
              <DartSlots darts={s.entered} total={visitTotal(s.entered)} bust={false} />
            </View>
          </View>
          <Keypad onHit={(hit) => setS(enter(s, labelOf(hit)))} disabled={full} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.miss')}
                onPress={() => setS(enter(s, MISS))}
                disabled={full}
                testID="value-miss"
              />
            </View>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.bounceOut')}
                onPress={() => setS(enter(s, BOUNCE_OUT))}
                disabled={full}
                testID="value-bounce"
              />
            </View>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.undo')}
                onPress={() => setS(undoEnter(s))}
                disabled={s.entered.length === 0}
                testID="value-undo"
              />
            </View>
          </View>
        </View>
      </StepFrame>
    );
  }

  if (s.step === 'board') {
    const step = markingPoint(s);
    return (
      <StepFrame
        title={t('label.boardTitle')}
        step={s.step}
        backLabel={backLabel}
        onBack={onBack}
        footer={
          <View style={styles.row}>
            {!step ? (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('label.markByHand')}
                  onPress={() => setS(remark(s))}
                  testID="label-remark"
                />
              </View>
            ) : null}
            <View style={styles.flex}>
              <Button
                label={t('label.toTips')}
                onPress={() => setS(toTips(s))}
                disabled={!s.fit}
                testID="to-tips"
              />
            </View>
          </View>
        }
      >
        <View style={styles.instruction}>
          {step ? (
            <>
              <Board
                size={52}
                muted
                markers={[{ point: boardPointOf(step), text: '' }]}
                markerRadius={4}
                accessibilityLabel={tg(`snap.mark.${step}`)}
              />
              <View style={styles.flex}>
                {s.markFailed ? (
                  <Text variant="caption" tone="danger">
                    {tg('snap.markFailed')}
                  </Text>
                ) : null}
                <Text variant="bodyStrong" testID="label-mark-step">
                  {tg(`snap.mark.${step}`)}
                </Text>
                <Text variant="caption" tone="muted">
                  {t('label.boardHint', { values: s.entered.join(' · ') })}
                </Text>
              </View>
            </>
          ) : (
            <Text variant="caption" tone="muted" style={styles.flex} testID="label-board-done">
              {s.boardFromModel ? t('label.boardFromModel') : t('label.boardDone')}
            </Text>
          )}
        </View>
        {photoMarkup(step ? (p) => setS(tapBoard(s, p)) : null)}
      </StepFrame>
    );
  }

  const blocked = list.filter((c) => !c.ok).length;

  if (s.step === 'tips') {
    return (
      <StepFrame
        title={t('label.tipsTitle')}
        step={s.step}
        backLabel={backLabel}
        onBack={onBack}
        footer={
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.saveValuesOnly')}
                onPress={() => save(true)}
                testID="save-values-only"
              />
            </View>
            <View style={styles.flex}>
              <Button
                label={
                  canReview(s)
                    ? t('label.toReview')
                    : t('label.toReviewBlocked', { count: blocked })
                }
                onPress={() => setS(toReview(s))}
                disabled={!canReview(s)}
                testID="to-review"
              />
            </View>
          </View>
        }
      >
        <View style={styles.instruction}>
          <Text variant="caption" tone="muted" style={styles.flex}>
            {s.tipsFromModel
              ? t('label.tipsFromModel', { count: s.tipsFromModel })
              : t('label.tipsHint')}
          </Text>
        </View>
        {photoMarkup((p) => setS(tapTip(s, p)))}
        <View style={styles.chips}>
          {list.map((c, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: s.selected === i }}
              accessibilityLabel={t('label.dartA11y', { n: i + 1, value: c.entered })}
              style={[
                styles.chip,
                s.selected === i && styles.chipOn,
                !c.ok && c.tip && styles.chipBad,
              ]}
              onPress={() => setS(selectDart(s, i))}
              testID={`tip-row-${i}`}
            >
              <Text variant="bodyStrong">{t('label.chip', { n: i + 1, value: c.entered })}</Text>
              <Text
                variant="caption"
                tone={c.tip && !c.match ? 'danger' : 'muted'}
                numberOfLines={1}
                testID={`tip-status-${i}`}
              >
                {!c.needsTip
                  ? t('label.noTip')
                  : !c.tip
                    ? t('label.tapTip')
                    : c.match
                      ? `${t('label.matchShort')}${c.nearWire ? ` · ${t('label.nearWire')}` : ''}`
                      : t('label.noMatchShort', { scored: c.scored ?? '?' })}
              </Text>
              {c.needsTip && c.tip ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: c.onWire }}
                  accessibilityLabel={t('label.wireA11y', { n: i + 1 })}
                  style={[styles.wire, c.onWire && styles.wireOn]}
                  onPress={() => setS(toggleWire(s, i))}
                  testID={`tip-wire-${i}`}
                >
                  <Text variant="caption" tone={c.onWire ? 'onAccent' : 'text'}>
                    {t('label.wire')}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
      </StepFrame>
    );
  }

  // Review
  return (
    <StepFrame
      title={t('label.reviewTitle')}
      step={s.step}
      backLabel={backLabel}
      onBack={onBack}
      footer={
        <View style={styles.footerStack}>
          <Button label={t('label.save')} onPress={() => save(false)} testID="save" />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.saveValuesOnly')}
                onPress={() => save(true)}
              />
            </View>
            <View style={styles.flex}>
              <Button kind="secondary" label={t('label.retake')} onPress={retake} />
            </View>
          </View>
        </View>
      }
    >
      {photoMarkup(null)}
      <View style={[styles.row, styles.pad]}>
        <View style={styles.flex}>
          <Text variant="overline" tone="muted">
            {t('label.total')}
          </Text>
          <Text variant="score" testID="review-total">{`${visitTotal(s.entered)}`}</Text>
        </View>
        <View style={styles.reviewRight}>
          <Text variant="title">{s.entered.join(' · ')}</Text>
          <Text variant="caption" tone="muted">
            {t('label.allMatch')}
            {s.boardFromModel || s.tipsFromModel
              ? ` · ${t('label.fromModel', { model: s.detected?.modelVersion ?? '?' })}`
              : ''}
          </Text>
        </View>
      </View>
    </StepFrame>
  );
}

const styles = StyleSheet.create((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    minHeight: 48,
    paddingHorizontal: theme.spacing.s,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    minWidth: 72,
    gap: 2,
  },
  flip: { transform: [{ scaleX: -1 }] },
  topTitle: { flex: 1, textAlign: 'center' },
  stepCount: { minWidth: 72, textAlign: 'right' },
  // Photo steps run edge to edge; text and controls keep a small margin.
  body: { flex: 1, gap: theme.spacing.s },
  footer: {
    paddingHorizontal: theme.spacing.m,
    paddingTop: theme.spacing.s,
    paddingBottom: theme.spacing.s,
  },
  footerStack: { gap: theme.spacing.s },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  pad: { paddingHorizontal: theme.spacing.m },
  values: { flex: 1, gap: theme.spacing.s, paddingHorizontal: theme.spacing.s },
  thumb: { width: 72, height: 72, borderRadius: theme.radii.s },
  instruction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    minHeight: 44,
    paddingHorizontal: theme.spacing.m,
  },
  chips: { flexDirection: 'row', gap: theme.spacing.xs, paddingHorizontal: theme.spacing.s },
  chip: {
    flex: 1,
    gap: 2,
    minHeight: 64,
    padding: theme.spacing.s,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  chipOn: { borderColor: theme.colors.accent },
  chipBad: { borderColor: theme.colors.danger },
  wire: {
    alignSelf: 'flex-start',
    minHeight: 28,
    paddingHorizontal: theme.spacing.s,
    borderRadius: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  wireOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  reviewRight: { alignItems: 'flex-end', gap: 2 },
}));
