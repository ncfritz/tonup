import { randomUUID } from 'expo-crypto';
import { Redirect, router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { hitAt } from '@/domain/board';
import { boardPointOf } from '@/domain/camera';
import { label as labelOf, type Hit } from '@/domain/darts';
import { heatmap } from '@/domain/stats';
import { PhotoMarkup, type MarkupDart } from '@/features/camera/PhotoMarkup';
import { uploader } from '@/features/capture-lab/lab';
import { syncOutbox } from '@/features/capture-lab/outbox';
import { fileDrafts, fileOutbox } from '@/features/capture-lab/outboxFiles';
import { nextDraft, stopLabelling } from '@/features/capture-lab/queue';
import {
  useCapture,
  useLabelRun,
  useLaterNote,
  useShot,
  type LabelRun,
  type Shot,
} from '@/features/capture-lab/store';
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
  resume,
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
import { LabPill } from '@/features/capture-lab/LabPill';
import { log } from '@/services/diagnostics';
import { haptics } from '@/services/haptics';
import {
  Board,
  Button,
  DartSlots,
  Icon,
  Keypad,
  Pressable,
  SegmentedControl,
  Text,
  useScreenReader,
} from '@/ui';

const STEPS: Step[] = ['values', 'board', 'tips', 'review'];

/**
 * Labelling one visit (docs/plan/capture-lab.md › Screens): what the darts scored, the board,
 * each tip, then review. Every tip has to score its value, or be flagged on the wire. Each step
 * fits the screen: the photo edge to edge (zoomable), its buttons pinned at the bottom.
 */
export default function LabelVisit() {
  const shot = useShot((s) => s.shot);
  const run = useLabelRun((r) => r.run);
  if (!shot) {
    return run && run.index >= run.ids.length ? <RunFinished run={run} /> : <Redirect href="/" />;
  }
  // A new photo (the next draft, say) starts afresh.
  return (
    <Labeller
      key={shot.draft?.id ?? shot.saved?.id ?? shot.photo.uri}
      shot={shot}
      initial={shot.saved ? resume(shot.photo, shot.saved) : start(shot.photo, shot.detected)}
    />
  );
}

/** After the last draft: how many were labelled, values only and skipped; then back, or snap. */
function RunFinished({ run }: { run: LabelRun }) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const session = useCapture((c) => c.session);
  const close = (then: () => void) => {
    useLabelRun.getState().setRun(null);
    then();
  };
  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safe, styles.done]} testID="label-done">
      <View style={styles.doneTop}>
        <LabPill />
      </View>
      <View style={styles.doneBody}>
        <View style={styles.doneMark}>
          <Icon name="check" color={theme.colors.accent} size={34} strokeWidth={2.4} />
        </View>
        <Text variant="heading" accessibilityRole="header" style={styles.center}>
          {run.skipped ? t('label.doneSomeTitle') : t('label.doneTitle')}
        </Text>
        <Text tone="muted" style={styles.center}>
          {run.skipped ? t('label.doneSkipped', { count: run.skipped }) : t('label.doneNote')}
        </Text>
        <View style={styles.doneCounts}>
          {(
            [
              [run.labelled, t('photos.labelled')],
              [run.valuesOnly, t('photos.valuesOnly')],
              [run.skipped, t('label.skipped')],
            ] as const
          ).map(([n, label]) => (
            <View key={label} style={styles.doneCount}>
              <Text variant="title">{`${n}`}</Text>
              <Text variant="caption" tone="muted">
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.footerStack}>
        {session ? (
          <Button
            label={t('label.backToCamera')}
            onPress={() => close(() => router.replace('/session'))}
            testID="label-done-camera"
          />
        ) : null}
        <Button
          kind={session ? 'secondary' : 'primary'}
          label={t('label.done')}
          onPress={() => close(() => router.back())}
          testID="label-done-close"
        />
      </View>
    </SafeAreaView>
  );
}

/** Labelling drafts one after another: which photo of how many, and Skip. */
function RunBar({ run }: { run: LabelRun }) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  return (
    <View style={styles.runBar} testID="label-run">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('label.stop')}
        style={styles.runStop}
        onPress={() => {
          useLabelRun.getState().setRun(null);
          stopLabelling();
        }}
        testID="label-run-stop"
      >
        <Icon name="close" color={theme.colors.text} />
      </Pressable>
      <View style={styles.flex}>
        <Text variant="caption">
          {t('label.runPlace', { k: run.index + 1, n: run.ids.length })}
        </Text>
        <View style={styles.runTrack} accessibilityElementsHidden>
          {run.ids.map((id, i) => (
            <View
              key={id}
              style={[
                styles.runSeg,
                i < run.index && styles.runSegDone,
                i === run.index && styles.runSegOn,
              ]}
            />
          ))}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('label.skipA11y')}
        style={styles.runSkip}
        onPress={() => void nextDraft('skipped')}
        testID="label-run-skip"
      >
        <Text variant="caption">{t('label.skip')}</Text>
        <Icon name="chevron" color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

/** One step's frame: a compact top bar, the step's content, its buttons at the bottom. */
function StepFrame({
  title,
  step,
  backLabel,
  onBack,
  run,
  children,
  footer,
}: {
  title: string;
  step: Step;
  backLabel: string;
  onBack: () => void;
  run: LabelRun | null;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      {run ? <RunBar run={run} /> : null}
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
        <View style={styles.topRight}>
          <LabPill />
          <Text variant="caption" tone="muted">
            {t('label.step', { n: STEPS.indexOf(step) + 1 })}
          </Text>
        </View>
      </View>
      <View style={styles.body}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

function Labeller({ initial, shot }: { initial: VisitState; shot: Shot }) {
  const { t } = useTranslation('capture');
  const draft = shot.draft ?? null;
  // A values-only visit opened to add its tips: no retake, no label later, saved as itself.
  const saved = shot.saved ?? null;
  const liveRun = useLabelRun((r) => r.run);
  const run = draft ? liveRun : null;
  const last = !run || run.index >= run.ids.length - 1;
  const { t: tg } = useTranslation('game');
  const [s, setVisit] = useState(initial);
  const [scale, setScale] = useState(1);
  const list = checks(s);
  // The values step: a board to tap or the keypad, as last picked. VoiceOver gets the keypad,
  // as in a game. Each entered dart's bed is lit on the board; only the value is kept.
  const picked = useCapture((c) => c.valuesInput);
  const screenReader = useScreenReader();
  const valuesInput = screenReader ? 'keypad' : picked;
  const [taps, setTaps] = useState<{ photo: string; at: (Hit | null)[] }>({
    photo: initial.photo.uri,
    at: [],
  });
  const tapped = taps.photo === s.photo.uri ? taps.at.slice(0, s.entered.length) : [];
  const [area, setArea] = useState({ w: 0, h: 0 });
  const onArea = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const boardSize = Math.floor(Math.max(0, Math.min(area.w, area.h)));
  const enterValue = (value: Parameters<typeof enter>[1], at: Hit | null) => {
    setTaps({ photo: s.photo.uri, at: [...tapped, at] });
    setS(enter(s, value));
  };

  // A new step starts with the whole photo in view.
  const setS = (next: VisitState) => {
    if (next.step !== s.step) setScale(1);
    setVisit(next);
  };

  const retake = () => {
    useShot.getState().setShot(null);
    router.back();
  };
  // A draft has no photo to retake: going back from its values leaves the run.
  const stop = () => {
    useLabelRun.getState().setRun(null);
    stopLabelling();
  };
  const leave = () => {
    useShot.getState().setShot(null);
    router.back();
  };
  const onBack = () =>
    s.step === 'values' ? (draft ? stop() : saved ? leave() : retake()) : setS(back(s));
  const backLabel =
    s.step === 'values'
      ? draft
        ? t('label.stop')
        : saved
          ? t('label.back')
          : t('label.retake')
      : t('label.back');

  const save = (valuesOnly: boolean) => {
    const { session: current, labUrl } = useCapture.getState();
    const session =
      draft?.session ??
      (saved
        ? { id: saved.sessionId, startedAt: saved.sessionStartedAt, tags: saved.tags }
        : current);
    if (!session) return;
    // A draft, or a visit labelled again, keeps its ID and the time it was taken.
    const id = draft?.id ?? saved?.id ?? randomUUID();
    const createdAt = draft?.createdAt ?? saved?.createdAt ?? new Date().toISOString();
    const zoom = draft?.zoom ?? saved?.zoom;
    const file = labelFile(s, { id, createdAt, session, zoom }, valuesOnly);
    try {
      fileOutbox.put(file, s.photo.uri);
      if (draft) fileDrafts.remove(draft.id);
    } catch (e) {
      log('error', 'capture: saving to the outbox failed', { error: String(e) });
      return;
    }
    haptics.success();
    // Send it now if Lab is there; it waits in the outbox if not.
    if (labUrl) void syncOutbox(fileOutbox, uploader(labUrl)).catch(() => {});
    if (draft) {
      void nextDraft(valuesOnly ? 'valuesOnly' : 'labelled');
      return;
    }
    if (saved) {
      leave();
      return;
    }
    useCapture.getState().savedVisit();
    useShot.getState().setShot(null);
    router.back();
  };

  /** Keeps the photo, unlabelled, for later; back to the camera for the next visit. */
  const labelLater = () => {
    const { session } = useCapture.getState();
    if (!session) return;
    const id = randomUUID();
    try {
      fileDrafts.put(
        {
          id,
          createdAt: new Date().toISOString(),
          session,
          width: s.photo.width,
          height: s.photo.height,
        },
        s.photo.uri,
      );
    } catch (e) {
      log('error', 'capture: saving a draft failed', { error: String(e) });
      return;
    }
    haptics.success();
    useCapture.getState().savedVisit();
    useLaterNote.getState().setNote(id);
    useShot.getState().setShot(null);
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
        run={run}
        footer={
          // Full width, a row each: put it off, keep just the values, or go on to the board.
          <View style={styles.stack}>
            {draft || saved ? null : (
              <Button
                kind="secondary"
                label={t('label.labelLater')}
                onPress={labelLater}
                testID="label-later"
              />
            )}
            <Button
              kind="secondary"
              label={run && !last ? t('label.valuesOnlyNext') : t('label.saveValuesOnly')}
              onPress={() => save(true)}
              disabled={!canLeaveValues(s)}
              testID="values-save-values-only"
            />
            <Button
              label={t('label.toBoard')}
              onPress={() => setS(toBoard(s))}
              disabled={!canLeaveValues(s)}
              testID="to-board"
            />
          </View>
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
          {screenReader ? null : (
            <SegmentedControl<'board' | 'keypad'>
              accessibilityLabel={tg('header.input')}
              value={valuesInput}
              onChange={(v) => useCapture.getState().set({ valuesInput: v })}
              segments={[
                { value: 'board', label: tg('header.board') },
                { value: 'keypad', label: tg('header.keypad') },
              ]}
            />
          )}
          {valuesInput === 'board' ? (
            <View style={styles.boardArea} onLayout={onArea} testID="values-board-area">
              {boardSize > 0 ? (
                <Board
                  size={boardSize}
                  heat={heatmap(tapped.filter((h) => h !== null)).regions}
                  onDart={
                    full
                      ? undefined
                      : (p) => {
                          haptics.light();
                          const hit = hitAt(p);
                          enterValue(labelOf(hit), hit);
                        }
                  }
                  accessibilityLabel={
                    s.entered.length
                      ? tg('board.a11yDarts', { darts: s.entered.join(', ') })
                      : tg('board.a11y')
                  }
                  accessibilityHint={tg('board.hint')}
                />
              ) : null}
            </View>
          ) : (
            <Keypad onHit={(hit) => enterValue(labelOf(hit), hit)} disabled={full} fill={false} />
          )}
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.miss')}
                onPress={() => enterValue(MISS, null)}
                disabled={full}
                testID="value-miss"
              />
            </View>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('label.bounceOut')}
                onPress={() => enterValue(BOUNCE_OUT, null)}
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
        run={run}
        footer={
          <View style={styles.stack}>
            {/* The values without the board or tips: both can be added later, here or in Lab. */}
            <Button
              kind="secondary"
              label={run && !last ? t('label.valuesOnlyNext') : t('label.saveValuesOnly')}
              onPress={() => save(true)}
              testID="board-save-values-only"
            />
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
        run={run}
        footer={
          <View style={styles.row}>
            {saved ? null : (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={run && !last ? t('label.valuesOnlyNext') : t('label.saveValuesOnly')}
                  onPress={() => save(true)}
                  testID="save-values-only"
                />
              </View>
            )}
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
      run={run}
      footer={
        <View style={styles.footerStack}>
          <Button
            label={
              draft
                ? last
                  ? t('label.saveDone')
                  : t('label.saveNext')
                : saved
                  ? t('label.saveTips')
                  : t('label.save')
            }
            onPress={() => save(false)}
            testID="save"
          />
          {saved ? null : (
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={run && !last ? t('label.valuesOnlyNext') : t('label.saveValuesOnly')}
                  onPress={() => save(true)}
                />
              </View>
              <View style={styles.flex}>
                {draft ? (
                  <Button
                    kind="secondary"
                    label={t('label.skip')}
                    onPress={() => void nextDraft('skipped')}
                  />
                ) : (
                  <Button kind="secondary" label={t('label.retake')} onPress={retake} />
                )}
              </View>
            </View>
          )}
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
  topRight: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  // Photo steps run edge to edge; text and controls keep a small margin.
  body: { flex: 1, gap: theme.spacing.s },
  footer: {
    paddingHorizontal: theme.spacing.m,
    paddingTop: theme.spacing.s,
    paddingBottom: theme.spacing.s,
  },
  footerStack: { gap: theme.spacing.s },
  flex: { flex: 1 },
  runBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    marginHorizontal: theme.spacing.s,
    marginBottom: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  runStop: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  runTrack: { flexDirection: 'row', gap: 3, marginTop: theme.spacing.xs },
  runSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.colors.line },
  runSegDone: { backgroundColor: theme.colors.accent },
  runSegOn: { backgroundColor: theme.colors.pending },
  runSkip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.xs,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  stack: { gap: theme.spacing.s },
  pad: { paddingHorizontal: theme.spacing.m },
  values: { flex: 1, gap: theme.spacing.s, paddingHorizontal: theme.spacing.s },
  boardArea: { flex: 1, minHeight: 200, alignItems: 'center', justifyContent: 'center' },
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
  done: { padding: theme.spacing.l },
  doneTop: { alignItems: 'flex-end' },
  doneBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.m },
  doneMark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  center: { textAlign: 'center' },
  doneCounts: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: theme.spacing.s,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  doneCount: { flex: 1, padding: theme.spacing.m },
}));
