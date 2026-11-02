import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { hitAt } from '@/domain/board';
import { drillFor, type DrillId } from '@/domain/drills';
import { BULL, hitOf, label, miss, type Point } from '@/domain/darts';
import { YOU_ID } from '@/features/game/lineup';
import { startDrill } from '@/features/game/session';
import { useGame } from '@/features/game/store';
import { personalBest } from '@/features/practice/bests';
import { DrillResult } from '@/features/practice/components/DrillResult';
import { StepStrip } from '@/features/practice/components/StepStrip';
import { haptics } from '@/services/haptics';
import { Board, Button, DartSlots, Header, Keypad, Screen, SegmentedControl, Text } from '@/ui';

type Input = 'buttons' | 'board' | 'keypad';

/** Drills with one target per dart get big Hit and Miss buttons (docs/design/screens.md). */
const HIT_MISS: DrillId[] = ['bobs27', 'clock'];

/** A drill in progress (docs/design/screens.md → Drill in progress). */
export default function DrillScreen() {
  useKeepAwake();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation('practice');
  const { t: tg } = useTranslation('game');
  const game = useGame((s) => s.game);
  const [area, setArea] = useState({ w: 0, h: 0 });

  useEffect(() => {
    useGame.getState().open(sessionId);
    return () => useGame.getState().close();
  }, [sessionId]);

  const drillId = game?.session.typeId as DrillId | undefined;
  const hitMiss = !!drillId && HIT_MISS.includes(drillId);
  const [input, setInput] = useState<Input | null>(null);
  const mode: Input = input ?? (hitMiss ? 'buttons' : 'board');
  // Your best before this go, fixed when the drill opens.
  const best = useMemo(
    () => (drillId ? personalBest(drillId, sessionId) : null),
    [drillId, sessionId],
  );

  if (!game || game.session.id !== sessionId || !drillId) {
    return <Screen edges={['top', 'bottom']}>{null}</Screen>;
  }

  const def = drillFor(drillId);
  const state = game.state;
  const over = def.result(state) !== null;
  const view = def.view(state);
  const visits = def.visits(state);
  const last = visits[visits.length - 1];
  const current = last && !last.done ? last : null;
  const shown = current ?? last ?? null;
  const target = def.targetFor(state);
  const score = def.score(state);
  const name = t(`drills.${drillId}.name`);

  const throwHit = (
    point: Point | null,
    source: 'tap' | 'keypad',
    hit = point ? hitAt(point) : miss(),
  ) => {
    if (over) return;
    haptics.light();
    useGame.getState().throwDart({ hit, point, source, intended: target ?? undefined });
  };
  const hitTarget = () => {
    if (!target) return;
    // A keypad hit on the target: the double in Bob's 27, the number (or bull) in the clock.
    const hit =
      target.segment === BULL
        ? hitOf(BULL, target.multiplier === 2 ? 2 : 1)
        : hitOf(target.segment, target.multiplier);
    throwHit(null, 'keypad', hit);
  };

  const again = () => {
    const id = startDrill(drillId, game.session.settings, { id: YOU_ID, name: tg('players.you') });
    router.replace({ pathname: '/drill/[sessionId]', params: { sessionId: id } });
  };

  const progress = view.round
    ? t(drillId === 'countUp' ? 'drill.visit' : 'drill.round', {
        n: view.round.n,
        of: view.round.of,
      })
    : target
      ? t('drill.target', { target: label(target) })
      : '';
  const gap = best ? Math.abs(score - best.score) : 0;
  const vsBest = !best
    ? t('drill.firstGo')
    : def.better === 'higher'
      ? score >= best.score
        ? t('drill.aheadOfBest', { gap })
        : t('drill.toBeat', { gap })
      : t('drill.best', { score: best.score });

  const onLayout = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const boardSize = Math.max(0, Math.min(area.w, area.h));
  const markers = (shown?.darts ?? [])
    .filter((d) => d.point)
    .map((d, i) => ({ point: d.point!, text: String(i + 1) }));

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={name}
        icon="pause"
        backLabel={t('drill.pause')}
        onBack={() => router.navigate('/practice')}
      />
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text variant="overline" tone="muted">
            {progress}
          </Text>
          <Text variant="caption" tone="muted">
            {vsBest}
          </Text>
        </View>
        <View
          style={styles.scoreBox}
          accessible
          accessibilityLabel={t('drill.scoreA11y', {
            what: def.better === 'lower' ? t('drill.darts') : t('drill.score'),
            score,
          })}
        >
          <Text variant="caption" tone="muted">
            {def.better === 'lower' ? t('drill.darts') : t('drill.score')}
          </Text>
          <Text variant="score">{score}</Text>
        </View>
      </View>
      <StepStrip steps={def.steps(state)} />
      <DartSlots
        darts={(shown?.darts ?? []).map((d) => label(d.hit))}
        total={shown?.total ?? 0}
        bust={false}
      />
      {over ? null : (
        <SegmentedControl<Input>
          accessibilityLabel={tg('header.input')}
          value={mode}
          onChange={setInput}
          segments={[
            ...(hitMiss ? [{ value: 'buttons' as const, label: t('drill.buttonsMode') }] : []),
            { value: 'board', label: tg('header.board') },
            { value: 'keypad', label: tg('header.keypad') },
          ]}
        />
      )}
      <View style={styles.input} onLayout={onLayout}>
        {over ? (
          <DrillResult
            def={def}
            state={state}
            best={best}
            onAgain={again}
            onClose={() => router.navigate('/practice')}
          />
        ) : mode === 'board' ? (
          boardSize > 0 ? (
            <Board
              size={boardSize}
              markers={markers}
              highlight={target}
              onDart={(p) => throwHit(p, 'tap')}
              accessibilityLabel={t('drill.boardA11y', { target: target ? label(target) : '' })}
              accessibilityHint={tg('board.hint')}
            />
          ) : null
        ) : mode === 'keypad' ? (
          <View style={styles.keypad}>
            <Keypad onHit={(hit) => throwHit(null, 'keypad', hit)} />
          </View>
        ) : (
          <View style={styles.bigButtons}>
            {boardSize > 0 ? (
              <Board
                size={Math.min(boardSize, area.h - 140)}
                muted
                markers={markers}
                highlight={target}
                accessibilityLabel={t('drill.boardA11y', { target: target ? label(target) : '' })}
              />
            ) : null}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button
                  label={t('drill.hit')}
                  accessibilityLabel={t('drill.hitA11y', { target: target ? label(target) : '' })}
                  onPress={hitTarget}
                  testID="drill-hit"
                />
              </View>
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('drill.miss')}
                  accessibilityLabel={t('drill.missA11y')}
                  onPress={() => throwHit(null, 'keypad', miss())}
                  testID="drill-miss"
                />
              </View>
            </View>
          </View>
        )}
      </View>
      {over ? null : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              kind="secondary"
              label={t('drill.undo')}
              onPress={() => useGame.getState().undo()}
              testID="undo"
            />
          </View>
          {mode !== 'buttons' ? (
            <View style={styles.flex}>
              <Button
                label={t('drill.next')}
                disabled={!current}
                onPress={() => useGame.getState().finishVisit()}
                testID="next"
              />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  scoreBox: { alignItems: 'flex-end' },
  input: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  keypad: { flex: 1, alignSelf: 'stretch' },
  bigButtons: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.m,
  },
  row: { flexDirection: 'row', gap: theme.spacing.s, alignSelf: 'stretch' },
}));
