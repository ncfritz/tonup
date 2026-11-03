import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FAMILIES, RULES, useRulesT } from '@/content/rules';
import { BOT_LEVELS, botLevel } from '@/domain/bot';
import type { OutRule } from '@/domain/checkout';
import type { PlayerRef } from '@/domain/darts';
import type { GameId } from '@/domain/games';
import type { InRule } from '@/domain/games/x01';
import { canPlayRules } from '@/domain/pro';
import {
  bestOf,
  botId,
  firstTo,
  isBot,
  MAX_PLAYERS,
  newGuest,
  YOU_ID,
} from '@/features/game/lineup';
import { deal, isPresetId, PRESETS, settingsFor, type PresetId } from '@/features/game/presets';
import { startGame } from '@/features/game/session';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { Button, Header, Icon, Pressable, Screen, Section, SegmentedControl, Text } from '@/ui';

const STARTS = ['301', '501', '701'] as const;
const LEGS = ['1', '3', '5', '7', '9'] as const;
const SETS = ['1', '3', '5'] as const;

type Settings = Record<string, unknown>;

/** New game (docs/design/screens.md → New game): pick one of the 26 games, its settings, players. */
export default function NewGame() {
  const { t } = useTranslation('game');
  const rt = useRulesT();
  const { theme } = useUnistyles();
  const proOwned = useProOwned();
  const lastGameId = useSettings((s) => s.lastGameId);
  const saved = useSettings((s) => s.gameSettings);
  const lastLineup = useSettings((s) => s.lastLineup);
  const setSetting = useSettings((s) => s.set);
  // Home's shortcuts and the rules pages open New game on a game.
  const { game: asked } = useLocalSearchParams<{ game?: string }>();
  const initial: PresetId = isPresetId(asked) ? asked : isPresetId(lastGameId) ? lastGameId : 'x01';
  const [presetId, setPresetId] = useState<PresetId>(initial);
  const preset = PRESETS[presetId];
  const game: GameId = preset.game;
  // Settings being edited, per game engine; a preset's fixed settings always apply on top.
  const [edits, setEdits] = useState<Partial<Record<GameId, Settings>>>({});
  const settings: Settings = {
    ...settingsFor(presetId, saved[game]),
    ...edits[game],
    ...preset.fixed,
  };
  const set = (patch: Settings) =>
    setEdits((e) => ({
      ...e,
      [game]: { ...settingsFor(presetId, saved[game]), ...e[game], ...patch },
    }));

  const [players, setPlayers] = useState<PlayerRef[]>(
    lastLineup ?? [
      { id: YOU_ID, name: t('players.you') },
      { id: botId(3), name: t('players.bot', { level: 3 }), botLevel: 3 },
    ],
  );
  const max = Math.min(MAX_PLAYERS, preset.players.max);
  const full = players.length >= max;

  const setPlayer = (i: number, p: PlayerRef) =>
    setPlayers((ps) => ps.map((q, j) => (j === i ? p : q)));
  const remove = (i: number) => setPlayers((ps) => ps.filter((_, j) => j !== i));
  const addGuest = () =>
    setPlayers((ps) => [...ps, newGuest(t('players.guest', { n: ps.length + 1 }))]);
  const addBot = () => {
    // A level not already playing, so each bot is its own player.
    const used = new Set(players.filter(isBot).map((p) => p.botLevel));
    const level = BOT_LEVELS.find((l) => !used.has(l.level))?.level;
    if (level === undefined) return;
    setPlayers((ps) => [
      ...ps,
      { id: botId(level), name: t('players.bot', { level }), botLevel: level },
    ]);
  };
  const changeLevel = (i: number, delta: number) => {
    const p = players[i]!;
    const level = (p.botLevel ?? 3) + delta;
    if (level < 1 || level > BOT_LEVELS.length) return;
    if (players.some((q, j) => j !== i && q.botLevel === level)) return;
    setPlayer(i, { id: botId(level), name: t('players.bot', { level }), botLevel: level });
  };

  const count = players.length;
  const wrongCount = count < preset.players.min || count > preset.players.max;
  const locked = !canPlayRules(presetId, proOwned);

  const start = () => {
    const lineup = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || t('players.guest', { n: i + 1 }),
    }));
    // Saved without what's dealt at the start (Killer numbers, Random Cricket's six).
    const { numbers: _dealt, ...keep } = settings;
    void _dealt;
    setSetting('lastGameId', presetId);
    setSetting('gameSettings', { ...saved, [game]: keep });
    setSetting('lastLineup', lineup);
    const id = startGame(game, deal(game, keep, lineup), lineup);
    router.replace({ pathname: '/game/[sessionId]', params: { sessionId: id } });
  };

  const pick = (id: PresetId) => {
    if (!canPlayRules(id, proOwned)) {
      router.push('/pro');
      return;
    }
    setPresetId(id);
  };
  const name = rt.t(`games.${presetId}.name`);
  const num = (k: string) => Number(settings[k]);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('newGame.title')} backLabel={t('edit.close')} onBack={() => router.back()} />
      <Section label={t('newGame.game')}>
        {FAMILIES.map((f) => (
          <View key={f} style={styles.family}>
            <Text variant="caption" tone="muted">
              {rt.t(`families.${f}`)}
            </Text>
            <View style={styles.chips}>
              {RULES.filter((r) => r.family === f).map((r) => {
                const id = r.id as PresetId;
                const on = id === presetId;
                const open = canPlayRules(id, proOwned);
                const label = rt.t(`games.${id}.name`);
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={open ? label : t('newGame.lockedA11y', { game: label })}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => pick(id)}
                    testID={`pick-${id}`}
                  >
                    {open ? null : <Icon name="lock" color={theme.colors.muted} size={14} />}
                    <Text variant="bodyStrong" tone={on ? 'onAccent' : open ? 'text' : 'muted'}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('newGame.rulesA11y', { game: name })}
          style={({ pressed }) => [styles.rulesLink, pressed && styles.pressed]}
          onPress={() => router.push({ pathname: '/rules/[gameId]', params: { gameId: presetId } })}
          testID="game-rules"
        >
          <Icon name="info" color={theme.colors.accent} size={18} />
          <Text variant="bodyStrong" tone="accent">
            {t('newGame.rules', { game: name })}
          </Text>
        </Pressable>
      </Section>

      <Section label={t('newGame.players')}>
        {players.map((p, i) => (
          <PlayerRow
            key={`${p.id}-${i}`}
            player={p}
            index={i}
            first={i === 0}
            canRemove={players.length > 1}
            onRename={(n) => setPlayer(i, { ...p, name: n })}
            onLevel={(d) => changeLevel(i, d)}
            onRemove={() => remove(i)}
          />
        ))}
        {full ? (
          <Text variant="caption" tone="muted">
            {t('newGame.maxPlayers', { max })}
          </Text>
        ) : (
          <View style={styles.addRow}>
            <View style={styles.flex}>
              <Button kind="secondary" label={t('newGame.addPlayer')} onPress={addGuest} />
            </View>
            <View style={styles.flex}>
              <Button kind="secondary" label={t('newGame.addBot')} onPress={addBot} />
            </View>
          </View>
        )}
        {wrongCount ? (
          <Text variant="caption" tone="danger" testID="player-count">
            {preset.players.min === preset.players.max
              ? t('newGame.exactly', { count: preset.players.min, game: name })
              : t('newGame.atLeast', { count: preset.players.min, game: name })}
          </Text>
        ) : null}
      </Section>

      {game === 'x01' ? (
        <>
          {presetId === 'x01' ? (
            <Section label={t('newGame.start')}>
              <SegmentedControl
                accessibilityLabel={t('newGame.start')}
                value={String(settings.startScore)}
                onChange={(v) => set({ startScore: Number(v) })}
                segments={STARTS.map((s) => ({ value: s, label: s }))}
              />
            </Section>
          ) : null}
          <Section label={t('newGame.format')}>
            <SegmentedControl
              accessibilityLabel={t('newGame.format')}
              value={String(bestOf(num('legs')))}
              onChange={(v) => set({ legs: firstTo(Number(v)) })}
              segments={LEGS.map((n) => ({ value: n, label: n }))}
            />
            <Text variant="caption" tone="muted">
              {t('newGame.legs', { count: bestOf(num('legs')) })}
            </Text>
            <Text variant="bodyStrong">{t('newGame.sets')}</Text>
            <SegmentedControl
              accessibilityLabel={t('newGame.sets')}
              value={String(bestOf(num('sets')))}
              onChange={(v) => set({ sets: firstTo(Number(v)) })}
              segments={SETS.map((n) => ({
                value: n,
                label: n === '1' ? t('newGame.setsOff') : t('newGame.setsOf', { count: Number(n) }),
              }))}
            />
          </Section>
          {presetId === 'x01' ? (
            <>
              <Section label={t('newGame.out')}>
                <SegmentedControl<OutRule>
                  accessibilityLabel={t('newGame.out')}
                  value={settings.out as OutRule}
                  onChange={(out) => set({ out })}
                  segments={[
                    { value: 'double', label: t('newGame.doubleOut') },
                    { value: 'master', label: t('newGame.masterOut') },
                    { value: 'straight', label: t('newGame.straightOut') },
                  ]}
                />
              </Section>
              <Section label={t('newGame.in')}>
                <SegmentedControl<InRule>
                  accessibilityLabel={t('newGame.in')}
                  value={settings.in as InRule}
                  onChange={(v) => set({ in: v })}
                  segments={[
                    { value: 'straight', label: t('newGame.straightIn') },
                    { value: 'double', label: t('newGame.doubleIn') },
                    { value: 'master', label: t('newGame.masterIn') },
                  ]}
                />
              </Section>
            </>
          ) : null}
        </>
      ) : null}

      {game === 'cricket' ? (
        <Section label={t('newGame.roundLimit')}>
          <SegmentedControl
            accessibilityLabel={t('newGame.roundLimit')}
            value={String(settings.roundLimit ?? 0)}
            onChange={(v) => set({ roundLimit: Number(v) || null })}
            segments={[
              { value: '10', label: '10' },
              { value: '20', label: '20' },
              { value: '0', label: t('newGame.noLimit') },
            ]}
          />
          {presetId === 'randomCricket' ? (
            <Text variant="caption" tone="muted">
              {t('newGame.randomNumbers')}
            </Text>
          ) : null}
        </Section>
      ) : null}

      {game === 'clock' ? (
        <Section label={t('newGame.clockRing')}>
          <SegmentedControl
            accessibilityLabel={t('newGame.clockRing')}
            value={String(settings.ring)}
            onChange={(ring) => set({ ring })}
            segments={[
              { value: 'any', label: t('newGame.anyRing') },
              { value: 'doubles', label: t('newGame.doublesOnly') },
              { value: 'trebles', label: t('newGame.treblesOnly') },
            ]}
          />
          <YesNo
            label={t('newGame.clockSkip')}
            value={!!settings.skip}
            onChange={(skip) => set({ skip })}
          />
          <YesNo
            label={t('newGame.clockBull')}
            value={!!settings.bull}
            onChange={(bull) => set({ bull })}
          />
        </Section>
      ) : null}

      {game === 'shanghai' ? (
        <Section label={t('newGame.rounds')}>
          <Choice
            value={num('rounds')}
            options={[7, 10, 20]}
            onChange={(rounds) => set({ rounds })}
            label={t('newGame.rounds')}
          />
          <YesNo
            label={t('newGame.instantWin')}
            value={!!settings.instantWin}
            onChange={(instantWin) => set({ instantWin })}
          />
        </Section>
      ) : null}

      {game === 'killer' ? (
        <Section label={t('newGame.lives')}>
          <Choice
            value={num('lives')}
            options={[3, 4, 5, 6]}
            onChange={(lives) => set({ lives })}
            label={t('newGame.lives')}
          />
          {presetId === 'killerCricket' ? null : (
            <>
              <Text variant="bodyStrong">{t('newGame.ownDouble')}</Text>
              <SegmentedControl
                accessibilityLabel={t('newGame.ownDouble')}
                value={String(settings.ownDouble)}
                onChange={(ownDouble) => set({ ownDouble })}
                segments={[
                  { value: 'loseLife', label: t('newGame.loseLife') },
                  { value: 'nothing', label: t('newGame.nothing') },
                ]}
              />
            </>
          )}
          <Text variant="caption" tone="muted">
            {presetId === 'blindKiller' ? t('newGame.blindNumbers') : t('newGame.killerNumbers')}
          </Text>
        </Section>
      ) : null}

      {game === 'gotcha' ? (
        <Section label={t('newGame.target')}>
          <Choice
            value={num('target')}
            options={[201, 301, 501]}
            onChange={(target) => set({ target })}
            label={t('newGame.target')}
          />
          <YesNo
            label={t('newGame.doubleOut')}
            value={!!settings.doubleOut}
            onChange={(doubleOut) => set({ doubleOut })}
          />
        </Section>
      ) : null}

      {game === 'fives' ? (
        <Section label={t('newGame.target')}>
          <Choice
            value={num('target')}
            options={[51, 61, 71, 101]}
            onChange={(target) => set({ target })}
            label={t('newGame.target')}
          />
        </Section>
      ) : null}

      {game === 'countUp' ? (
        <Section label={t('newGame.visits')}>
          <Choice
            value={num('visits')}
            options={[6, 8, 10, 12]}
            onChange={(visits) => set({ visits })}
            label={t('newGame.visits')}
          />
        </Section>
      ) : null}

      {game === 'hareHounds' ? (
        <Section label={t('newGame.headStart')}>
          <Choice
            value={num('headStart')}
            options={[3, 5, 7]}
            onChange={(headStart) => set({ headStart })}
            label={t('newGame.headStart')}
          />
          <Text variant="caption" tone="muted">
            {t('newGame.hareFirst')}
          </Text>
        </Section>
      ) : null}

      {game === 'scam' ? (
        <Text variant="caption" tone="muted">
          {t('newGame.scamRoles')}
        </Text>
      ) : null}

      {game === 'golf' ? (
        <Section label={t('newGame.holes')}>
          <Choice
            value={num('holes')}
            options={[9, 18]}
            onChange={(holes) => set({ holes })}
            label={t('newGame.holes')}
          />
        </Section>
      ) : null}

      {game === 'football' ? (
        <Section label={t('newGame.goals')}>
          <Choice
            value={num('goals')}
            options={[5, 10]}
            onChange={(goals) => set({ goals })}
            label={t('newGame.goals')}
          />
        </Section>
      ) : null}

      {game === 'ticTacToe' ? (
        <Section label={t('newGame.claim')}>
          <SegmentedControl
            accessibilityLabel={t('newGame.claim')}
            value={String(settings.ring)}
            onChange={(ring) => set({ ring })}
            segments={[
              { value: 'any', label: t('newGame.anyRing') },
              { value: 'doubles', label: t('newGame.doublesOnly') },
              { value: 'trebles', label: t('newGame.treblesOnly') },
            ]}
          />
        </Section>
      ) : null}

      <Button
        label={t('newGame.continue')}
        onPress={start}
        disabled={wrongCount || locked}
        testID="start-game"
      />
    </Screen>
  );
}

/** A row of numbers to choose from. */
function Choice({
  value,
  options,
  onChange,
  label,
}: {
  value: number;
  options: number[];
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <SegmentedControl
      accessibilityLabel={label}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      segments={options.map((o) => ({ value: String(o), label: String(o) }))}
    />
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useTranslation('game');
  return (
    <>
      <Text variant="bodyStrong">{label}</Text>
      <SegmentedControl
        accessibilityLabel={label}
        value={value ? 'yes' : 'no'}
        onChange={(v) => onChange(v === 'yes')}
        segments={[
          { value: 'yes', label: t('newGame.yes') },
          { value: 'no', label: t('newGame.no') },
        ]}
      />
    </>
  );
}

function PlayerRow({
  player,
  index,
  first,
  canRemove,
  onRename,
  onLevel,
  onRemove,
}: {
  player: PlayerRef;
  index: number;
  first: boolean;
  canRemove: boolean;
  onRename: (name: string) => void;
  onLevel: (delta: number) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('game');
  const { theme } = useUnistyles();
  const bot = isBot(player);
  return (
    <View style={styles.player}>
      <View style={styles.flex}>
        {bot || player.id === YOU_ID ? (
          <Text variant="title">{player.name}</Text>
        ) : (
          <TextInput
            value={player.name}
            onChangeText={onRename}
            accessibilityLabel={t('newGame.nameLabel', { n: index + 1 })}
            style={[theme.type.title, { color: theme.colors.text }]}
            maxLength={24}
            returnKeyType="done"
          />
        )}
        <Text variant="caption" tone="muted">
          {bot
            ? t('players.botLevel', {
                level: player.botLevel,
                average: botLevel(player.botLevel!).targetAverage,
              })
            : first
              ? t('newGame.throwsFirst')
              : ' '}
        </Text>
      </View>
      {bot ? (
        <View style={styles.stepper} accessibilityRole="adjustable">
          <SmallButton label="−" a11y={t('newGame.easier')} onPress={() => onLevel(-1)} />
          <SmallButton label="+" a11y={t('newGame.harder')} onPress={() => onLevel(1)} />
        </View>
      ) : null}
      {canRemove ? (
        <SmallButton
          label="×"
          a11y={t('newGame.remove', { name: player.name })}
          onPress={onRemove}
        />
      ) : null}
    </View>
  );
}

function SmallButton({
  label,
  a11y,
  onPress,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [styles.small, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text variant="title">{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', gap: theme.spacing.s },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
  },
  stepper: { flexDirection: 'row', gap: theme.spacing.xs },
  small: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  family: { gap: theme.spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 40,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { backgroundColor: theme.colors.accent },
  rulesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
}));
