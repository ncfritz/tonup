import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { hitAt } from '@/domain/board';
import { label, miss, type DartEvent, type Point } from '@/domain/darts';
import { EditDartSheet } from '@/features/game/components/EditDartSheet';
import { LegSummary } from '@/features/game/components/LegSummary';
import { VisitsSheet } from '@/features/game/components/VisitsSheet';
import { headerTitle, rowFormat } from '@/features/game/format';
import { bestOf } from '@/features/game/lineup';
import { x01State } from '@/features/game/session';
import { botUp, dartsText, useGame } from '@/features/game/store';
import { useBotTurns } from '@/features/game/useBotTurns';
import { useSettings } from '@/features/settings/store';
import { haptics } from '@/services/haptics';
import {
  Board,
  Button,
  DartSlots,
  Header,
  Keypad,
  Pressable,
  Scoreboard,
  Screen,
  SegmentedControl,
  Text,
  type BoardMarker,
} from '@/ui';

type Input = 'board' | 'keypad';

export default function GameScreen() {
  useKeepAwake();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { t } = useTranslation('game');
  const game = useGame((s) => s.game);
  const legPause = useGame((s) => s.legPause);
  const [input, setInput] = useState<Input>(() => useSettings.getState().defaultInput);
  const [editing, setEditing] = useState<{ dart: DartEvent; n: number } | null>(null);
  const [visitsOpen, setVisitsOpen] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  useEffect(() => {
    useGame.getState().open(sessionId);
    return () => useGame.getState().close();
  }, [sessionId]);

  const finished = !!game && game.def.result(game.state) !== null;
  useEffect(() => {
    if (finished) {
      router.replace({ pathname: '/summary/[sessionId]', params: { sessionId } });
    }
  }, [finished, sessionId]);

  useBotTurns(!!editing || visitsOpen);

  if (!game || game.session.id !== sessionId)
    return <Screen edges={['top', 'bottom']}>{null}</Screen>;

  const { def, state } = game;
  const isX01 = game.session.typeId === 'x01';
  const players = game.session.players;
  const view = def.view(state);
  const visits = def.visits(state);
  const last = visits[visits.length - 1];
  const up = def.currentPlayer(state);
  const upIndex = up ? players.findIndex((p) => p.id === up.id) : -1;
  const current = last && !last.done ? last : null;
  const shown = current ?? (last && last.player !== upIndex ? last : null);
  const botLevel = botUp(game);
  const humanTurn = botLevel === null && !legPause && !!up;
  const lastBotVisit = [...visits]
    .reverse()
    .find((v) => players[v.player]?.botLevel !== undefined && v.done);

  const throwHit = (
    point: Point | null,
    source: 'tap' | 'keypad',
    hit = point ? hitAt(point) : miss(),
  ) => {
    if (!humanTurn) return;
    haptics.light();
    useGame
      .getState()
      .throwDart({ hit, point, source, intended: def.targetFor(state) ?? undefined });
  };

  const markers: BoardMarker[] = (shown?.darts ?? [])
    .filter((d) => d.point)
    .map((d, i) => ({ point: d.point!, text: String(i + 1) }));

  const onLayout = (e: LayoutChangeEvent) =>
    setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const boardSize = Math.max(0, Math.min(area.w, area.h));

  let title = headerTitle(t, game, view);
  if (isX01) {
    const s = x01State(game);
    title =
      s.settings.sets > 1
        ? t('header.titleSets', {
            start: s.settings.startScore,
            set: s.set + 1,
            leg: s.legInSet + 1,
          })
        : t('header.title', {
            start: s.settings.startScore,
            format: t('newGame.legs', { count: bestOf(s.settings.legs) }),
            leg: s.leg + 1,
          });
  }
  const showSets = isX01 && x01State(game).settings.sets > 1;

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={title}
        icon="pause"
        backLabel={t('header.pause')}
        onBack={() => router.navigate('/')}
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('header.visits')}
            style={styles.visitsButton}
            onPress={() => setVisitsOpen(true)}
            testID="open-visits"
          >
            <Text variant="bodyStrong">{t('header.visits')}</Text>
          </Pressable>
        }
      />
      <Scoreboard
        view={view}
        showLegs={isX01}
        showSets={showSets}
        format={rowFormat(t, game.session.typeId)}
      />
      <DartSlots
        darts={(shown?.darts ?? []).map((d) => label(d.hit))}
        total={shown && !shown.bust ? shown.total : 0}
        bust={!!shown?.bust}
        onPressDart={(i) => {
          const d = shown?.darts[i];
          if (d) setEditing({ dart: d, n: i + 1 });
        }}
      />
      <SegmentedControl<Input>
        accessibilityLabel={t('header.input')}
        value={input}
        onChange={setInput}
        segments={[
          { value: 'board', label: t('header.board') },
          { value: 'keypad', label: t('header.keypad') },
        ]}
      />
      <View style={styles.input} onLayout={onLayout}>
        {legPause && isX01 ? (
          <LegSummary
            state={x01State(game)}
            onNext={() => useGame.getState().continueAfterLeg()}
            onUndo={() => useGame.getState().undo()}
          />
        ) : input === 'board' ? (
          boardSize > 0 ? (
            <Board
              size={boardSize}
              markers={markers}
              onDart={humanTurn ? (p) => throwHit(p, 'tap') : undefined}
              accessibilityLabel={t('board.a11y')}
              accessibilityHint={t('board.hint')}
            />
          ) : null
        ) : (
          <View style={styles.keypad}>
            <Keypad disabled={!humanTurn} onHit={(hit) => throwHit(null, 'keypad', hit)} />
          </View>
        )}
      </View>
      <Text variant="caption" tone="muted" style={styles.botLine} accessibilityLiveRegion="polite">
        {botLevel !== null && up
          ? t('botThinking', { name: up.name })
          : lastBotVisit
            ? t('botLine', {
                name: players[lastBotVisit.player]!.name,
                darts: dartsText(lastBotVisit.darts.map((d) => d.hit)),
                total: lastBotVisit.bust ? t('slots.bust') : lastBotVisit.total,
              })
            : ' '}
      </Text>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            kind="secondary"
            label={t('actions.undo')}
            onPress={() => useGame.getState().undo()}
            testID="undo"
          />
        </View>
        <View style={styles.flex}>
          <Button
            kind="secondary"
            label={t('actions.miss')}
            disabled={!humanTurn}
            onPress={() => throwHit(null, 'keypad', miss())}
            testID="miss"
          />
        </View>
        <View style={styles.flex}>
          <Button
            label={t('actions.next')}
            disabled={!humanTurn || !current}
            onPress={() => useGame.getState().finishVisit()}
            testID="next"
          />
        </View>
      </View>
      <EditDartSheet
        dart={editing?.dart ?? null}
        number={editing?.n ?? 1}
        onClose={() => setEditing(null)}
      />
      <VisitsSheet
        visible={visitsOpen}
        onClose={() => setVisitsOpen(false)}
        onEdit={(dart, n) => {
          setVisitsOpen(false);
          // Let the first sheet close before the next opens (iOS shows one at a time).
          setTimeout(() => setEditing({ dart, n }), 350);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  input: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  keypad: { flex: 1, alignSelf: 'stretch' },
  botLine: { minHeight: 18 },
  actions: { flexDirection: 'row', gap: theme.spacing.s },
  flex: { flex: 1 },
  visitsButton: {
    height: 44,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
