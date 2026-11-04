import { randomUUID } from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

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
  type VisitState,
} from '@/features/capture-lab/visit';
import { haptics } from '@/services/haptics';
import { log } from '@/services/diagnostics';
import { Board, Button, DartSlots, Header, Keypad, Pressable, Screen, Text } from '@/ui';

/**
 * Labelling one visit (docs/plan/capture-lab.md › Screens): what the darts scored, the board,
 * each tip, then review. Every tip has to score its value, or be flagged on the wire.
 */
export default function LabelVisit() {
  const shot = useShot((s) => s.shot);
  if (!shot) return <Redirect href="/session" />;
  return <Labeller initial={start(shot.photo, shot.detected)} />;
}

function Labeller({ initial }: { initial: VisitState }) {
  const { t } = useTranslation('capture');
  const { t: tg } = useTranslation('game');
  const [s, setS] = useState(initial);
  const list = checks(s);

  const retake = () => {
    useShot.getState().setShot(null);
    router.back();
  };
  const onBack = () => (s.step === 'values' ? retake() : setS(back(s)));

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
      <PhotoMarkup
        photo={s.photo}
        fit={s.fit}
        calibration={s.calibration}
        darts={darts}
        selected={selected !== null && selected >= 0 ? selected : null}
        selectNear={s.step === 'tips'}
        onTap={(p) => {
          if (!onTap) return;
          haptics.light();
          onTap(p);
        }}
        onSelect={(k) => setS(selectDart(s, indexOf[k] ?? null))}
      />
    );
  };

  if (s.step === 'values') {
    return (
      <Screen edges={['top', 'bottom']}>
        <Header title={t('label.valuesTitle')} backLabel={t('label.retake')} onBack={onBack} />
        <Text variant="caption" tone="muted">
          {t('label.valuesHint')}
        </Text>
        <Image source={{ uri: s.photo.uri }} style={styles.thumb} resizeMode="cover" />
        <DartSlots darts={s.entered} total={visitTotal(s.entered)} bust={false} />
        <Keypad onHit={(hit) => setS(enter(s, labelOf(hit)))} disabled={s.entered.length >= 3} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              kind="secondary"
              label={t('label.miss')}
              onPress={() => setS(enter(s, MISS))}
              disabled={s.entered.length >= 3}
              testID="value-miss"
            />
          </View>
          <View style={styles.flex}>
            <Button
              kind="secondary"
              label={t('label.bounceOut')}
              onPress={() => setS(enter(s, BOUNCE_OUT))}
              disabled={s.entered.length >= 3}
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
        <Button
          label={t('label.toBoard')}
          onPress={() => setS(toBoard(s))}
          disabled={!canLeaveValues(s)}
          testID="to-board"
        />
      </Screen>
    );
  }

  if (s.step === 'board') {
    const step = markingPoint(s);
    return (
      <Screen scroll edges={['top', 'bottom']}>
        <Header title={t('label.boardTitle')} backLabel={t('label.back')} onBack={onBack} />
        <Text variant="caption" tone="muted">
          {t('label.boardHint', { values: s.entered.join(' · ') })}
        </Text>
        {step ? (
          <View style={styles.markRow}>
            <Board
              size={88}
              muted
              markers={[{ point: boardPointOf(step), text: '' }]}
              markerRadius={5}
              accessibilityLabel={tg(`snap.mark.${step}`)}
            />
            <View style={styles.flex}>
              {s.markFailed ? <Text tone="danger">{tg('snap.markFailed')}</Text> : null}
              <Text variant="bodyStrong" testID="label-mark-step">
                {tg(`snap.mark.${step}`)}
              </Text>
            </View>
          </View>
        ) : (
          <Text tone="muted" testID="label-board-done">
            {s.boardFromModel ? t('label.boardFromModel') : t('label.boardDone')}
          </Text>
        )}
        {photoMarkup(step ? (p) => setS(tapBoard(s, p)) : null)}
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
      </Screen>
    );
  }

  const blocked = list.filter((c) => !c.ok).length;

  if (s.step === 'tips') {
    return (
      <Screen scroll edges={['top', 'bottom']}>
        <Header title={t('label.tipsTitle')} backLabel={t('label.back')} onBack={onBack} />
        <Text variant="caption" tone="muted">
          {s.tipsFromModel
            ? t('label.tipsFromModel', { count: s.tipsFromModel })
            : t('label.tipsHint')}
        </Text>
        {photoMarkup((p) => setS(tapTip(s, p)))}
        <View style={styles.list}>
          {list.map((c, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityState={{ selected: s.selected === i }}
              accessibilityLabel={t('label.dartA11y', { n: i + 1, value: c.entered })}
              style={[
                styles.dart,
                s.selected === i && styles.dartOn,
                !c.ok && c.tip && styles.dartBad,
              ]}
              onPress={() => setS(selectDart(s, i))}
              testID={`tip-row-${i}`}
            >
              <Text variant="value">{`${i + 1}`}</Text>
              <View style={styles.flex}>
                <Text variant="title">{c.entered}</Text>
                <Text
                  variant="caption"
                  tone={c.tip && !c.match ? 'danger' : 'muted'}
                  testID={`tip-status-${i}`}
                >
                  {!c.needsTip
                    ? t('label.noTip')
                    : !c.tip
                      ? t('label.tapTip')
                      : c.match
                        ? `${t('label.match')}${c.nearWire ? ` · ${t('label.nearWire')}` : ''}`
                        : t('label.noMatch', { scored: c.scored ?? '?', entered: c.entered })}
                </Text>
              </View>
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
                    {t('label.onWire')}
                  </Text>
                </Pressable>
              ) : null}
            </Pressable>
          ))}
        </View>
        <Button
          label={
            canReview(s) ? t('label.toReview') : t('label.toReviewBlocked', { count: blocked })
          }
          onPress={() => setS(toReview(s))}
          disabled={!canReview(s)}
          testID="to-review"
        />
        <Button
          kind="secondary"
          label={t('label.saveValuesOnly')}
          onPress={() => save(true)}
          testID="save-values-only"
        />
      </Screen>
    );
  }

  // Review
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('label.reviewTitle')} backLabel={t('label.back')} onBack={onBack} />
      {photoMarkup(null)}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="overline" tone="muted">
            {t('label.total')}
          </Text>
          <Text variant="score" testID="review-total">{`${visitTotal(s.entered)}`}</Text>
        </View>
        <Text variant="title">{s.entered.join(' · ')}</Text>
      </View>
      <Text tone="muted">
        {t('label.allMatch')}
        {s.boardFromModel || s.tipsFromModel
          ? ` · ${t('label.fromModel', { model: s.detected?.modelVersion ?? '?' })}`
          : ''}
      </Text>
      <Button label={t('label.save')} onPress={() => save(false)} testID="save" />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button kind="secondary" label={t('label.saveValuesOnly')} onPress={() => save(true)} />
        </View>
        <View style={styles.flex}>
          <Button kind="secondary" label={t('label.retake')} onPress={retake} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  thumb: { alignSelf: 'stretch', height: 120, borderRadius: theme.radii.m },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  list: { gap: theme.spacing.xs },
  dart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    minHeight: 56,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  dartOn: { borderWidth: 2, borderColor: theme.colors.accent },
  dartBad: { borderWidth: 2, borderColor: theme.colors.danger },
  wire: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: 18,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  wireOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
}));
