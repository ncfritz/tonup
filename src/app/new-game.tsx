import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BOT_LEVELS, botLevel } from '@/domain/bot';
import type { PlayerRef } from '@/domain/darts';
import type { OutRule } from '@/domain/checkout';
import type { GameId } from '@/domain/games';
import { CLOCK_DEFAULTS, type ClockSettings } from '@/domain/games/clock';
import { CRICKET_DEFAULTS, type CricketSettings } from '@/domain/games/cricket';
import { drawNumbers, KILLER_DEFAULTS, type KillerSettings } from '@/domain/games/killer';
import { SHANGHAI_DEFAULTS, type ShanghaiSettings } from '@/domain/games/shanghai';
import { X01_DEFAULTS, type InRule, type X01Settings } from '@/domain/games/x01';
import {
  bestOf,
  botId,
  firstTo,
  isBot,
  MAX_PLAYERS,
  newGuest,
  YOU_ID,
} from '@/features/game/lineup';
import { startGame } from '@/features/game/session';
import { useSettings } from '@/features/settings/store';
import { Button, Header, Pressable, Screen, Section, SegmentedControl, Text } from '@/ui';

const GAMES: GameId[] = ['x01', 'cricket', 'clock', 'shanghai', 'killer'];
const STARTS = ['301', '501', '701'] as const;
const LEGS = ['1', '3', '5', '7', '9'] as const;
const SETS = ['1', '3', '5'] as const;

export default function NewGame() {
  const { t } = useTranslation('game');
  const lastGameId = useSettings((s) => s.lastGameId);
  const saved = useSettings((s) => s.gameSettings);
  const lastLineup = useSettings((s) => s.lastLineup);
  const setSetting = useSettings((s) => s.set);
  // Home's shortcuts open New game on a game.
  const { game: asked, variant } = useLocalSearchParams<{ game?: string; variant?: string }>();
  const [gameId, setGameId] = useState<GameId>(
    GAMES.includes(asked as GameId) ? (asked as GameId) : lastGameId,
  );
  const [settings, setSettings] = useState<X01Settings>(
    (saved.x01 as X01Settings | undefined) ?? X01_DEFAULTS,
  );
  const [cricketSettings, setCricket] = useState<CricketSettings>(() => {
    const base = (saved.cricket as CricketSettings | undefined) ?? CRICKET_DEFAULTS;
    // A rules page can ask for a variant ("Play Cut-Throat Cricket").
    return variant === 'standard' || variant === 'cutThroat' ? { ...base, variant } : base;
  });
  const [clockSettings, setClock] = useState<ClockSettings>(
    (saved.clock as ClockSettings | undefined) ?? CLOCK_DEFAULTS,
  );
  const [shanghaiSettings, setShanghai] = useState<ShanghaiSettings>(
    (saved.shanghai as ShanghaiSettings | undefined) ?? SHANGHAI_DEFAULTS,
  );
  const [killerSettings, setKiller] = useState<KillerSettings>(
    (saved.killer as KillerSettings | undefined) ?? KILLER_DEFAULTS,
  );
  const [players, setPlayers] = useState<PlayerRef[]>(
    lastLineup ?? [
      { id: YOU_ID, name: t('players.you') },
      { id: botId(3), name: t('players.bot', { level: 3 }), botLevel: 3 },
    ],
  );
  const update = (patch: Partial<X01Settings>) => setSettings((s) => ({ ...s, ...patch }));
  const full = players.length >= MAX_PLAYERS;

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

  const chosen = (): unknown => {
    switch (gameId) {
      case 'x01':
        return settings;
      case 'cricket':
        return cricketSettings;
      case 'clock':
        return clockSettings;
      case 'shanghai':
        return shanghaiSettings;
      case 'killer':
        return { ...killerSettings, numbers: [] };
    }
  };
  const tooFew = gameId === 'killer' && players.length < 2;

  const start = () => {
    const lineup = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || t('players.guest', { n: i + 1 }),
    }));
    const stored = chosen();
    setSetting('lastGameId', gameId);
    setSetting('gameSettings', { ...saved, [gameId]: stored });
    setSetting('lastLineup', lineup);
    // Killer numbers are drawn fresh for each game.
    const play =
      gameId === 'killer'
        ? { ...(stored as KillerSettings), numbers: drawNumbers(lineup.length, Math.random) }
        : stored;
    const id = startGame(gameId, play, lineup);
    router.replace({ pathname: '/game/[sessionId]', params: { sessionId: id } });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('newGame.title')} backLabel={t('edit.close')} onBack={() => router.back()} />
      <Section label={t('newGame.game')}>
        <SegmentedControl<GameId>
          accessibilityLabel={t('newGame.game')}
          value={gameId}
          onChange={setGameId}
          segments={GAMES.map((g) => ({ value: g, label: t(`newGame.gameShort.${g}`) }))}
        />
        {gameId === 'x01' ? (
          <SegmentedControl
            accessibilityLabel={t('newGame.start')}
            value={String(settings.startScore)}
            onChange={(v) => update({ startScore: Number(v) })}
            segments={STARTS.map((s) => ({ value: s, label: s }))}
          />
        ) : null}
      </Section>
      <Section label={t('newGame.players')}>
        {players.map((p, i) => (
          <PlayerRow
            key={`${p.id}-${i}`}
            player={p}
            index={i}
            first={i === 0}
            canRemove={players.length > 1}
            onRename={(name) => setPlayer(i, { ...p, name })}
            onLevel={(d) => changeLevel(i, d)}
            onRemove={() => remove(i)}
          />
        ))}
        {full ? (
          <Text variant="caption" tone="muted">
            {t('newGame.maxPlayers', { max: MAX_PLAYERS })}
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
      </Section>
      {gameId === 'x01' ? (
        <>
          <Section label={t('newGame.format')}>
            <SegmentedControl
              accessibilityLabel={t('newGame.format')}
              value={String(bestOf(settings.legs))}
              onChange={(v) => update({ legs: firstTo(Number(v)) })}
              segments={LEGS.map((n) => ({ value: n, label: n }))}
            />
            <Text variant="caption" tone="muted">
              {t('newGame.legs', { count: bestOf(settings.legs) })}
            </Text>
            <Text variant="bodyStrong">{t('newGame.sets')}</Text>
            <SegmentedControl
              accessibilityLabel={t('newGame.sets')}
              value={String(bestOf(settings.sets))}
              onChange={(v) => update({ sets: firstTo(Number(v)) })}
              segments={SETS.map((n) => ({
                value: n,
                label: n === '1' ? t('newGame.setsOff') : t('newGame.setsOf', { count: Number(n) }),
              }))}
            />
          </Section>
          <Section label={t('newGame.out')}>
            <SegmentedControl<OutRule>
              accessibilityLabel={t('newGame.out')}
              value={settings.out}
              onChange={(out) => update({ out })}
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
              value={settings.in}
              onChange={(v) => update({ in: v })}
              segments={[
                { value: 'straight', label: t('newGame.straightIn') },
                { value: 'double', label: t('newGame.doubleIn') },
                { value: 'master', label: t('newGame.masterIn') },
              ]}
            />
          </Section>
        </>
      ) : null}
      {gameId === 'cricket' ? (
        <Section label={t('newGame.cricketVariant')}>
          <SegmentedControl<CricketSettings['variant']>
            accessibilityLabel={t('newGame.cricketVariant')}
            value={cricketSettings.variant}
            onChange={(variant) => setCricket((c) => ({ ...c, variant }))}
            segments={[
              { value: 'standard', label: t('newGame.standard') },
              { value: 'cutThroat', label: t('newGame.cutThroatShort') },
            ]}
          />
          <Text variant="bodyStrong">{t('newGame.roundLimit')}</Text>
          <SegmentedControl
            accessibilityLabel={t('newGame.roundLimit')}
            value={String(cricketSettings.roundLimit ?? 0)}
            onChange={(v) => setCricket((c) => ({ ...c, roundLimit: Number(v) || null }))}
            segments={[
              { value: '10', label: '10' },
              { value: '20', label: '20' },
              { value: '0', label: t('newGame.noLimit') },
            ]}
          />
        </Section>
      ) : null}
      {gameId === 'clock' ? (
        <Section label={t('newGame.clockRing')}>
          <SegmentedControl<ClockSettings['ring']>
            accessibilityLabel={t('newGame.clockRing')}
            value={clockSettings.ring}
            onChange={(ring) => setClock((c) => ({ ...c, ring }))}
            segments={[
              { value: 'any', label: t('newGame.anyRing') },
              { value: 'doubles', label: t('newGame.doublesOnly') },
              { value: 'trebles', label: t('newGame.treblesOnly') },
            ]}
          />
          <YesNo
            label={t('newGame.clockSkip')}
            value={clockSettings.skip}
            onChange={(skip) => setClock((c) => ({ ...c, skip }))}
          />
          <YesNo
            label={t('newGame.clockBull')}
            value={clockSettings.bull}
            onChange={(bull) => setClock((c) => ({ ...c, bull }))}
          />
        </Section>
      ) : null}
      {gameId === 'shanghai' ? (
        <Section label={t('newGame.rounds')}>
          <SegmentedControl
            accessibilityLabel={t('newGame.rounds')}
            value={String(shanghaiSettings.rounds)}
            onChange={(v) => setShanghai((c) => ({ ...c, rounds: Number(v) }))}
            segments={[
              { value: '7', label: '7' },
              { value: '10', label: '10' },
              { value: '20', label: '20' },
            ]}
          />
          <YesNo
            label={t('newGame.instantWin')}
            value={shanghaiSettings.instantWin}
            onChange={(instantWin) => setShanghai((c) => ({ ...c, instantWin }))}
          />
        </Section>
      ) : null}
      {gameId === 'killer' ? (
        <Section label={t('newGame.lives')}>
          <SegmentedControl
            accessibilityLabel={t('newGame.lives')}
            value={String(killerSettings.lives)}
            onChange={(v) => setKiller((c) => ({ ...c, lives: Number(v) }))}
            segments={['3', '4', '5', '6'].map((n) => ({ value: n, label: n }))}
          />
          <Text variant="bodyStrong">{t('newGame.ownDouble')}</Text>
          <SegmentedControl<KillerSettings['ownDouble']>
            accessibilityLabel={t('newGame.ownDouble')}
            value={killerSettings.ownDouble}
            onChange={(ownDouble) => setKiller((c) => ({ ...c, ownDouble }))}
            segments={[
              { value: 'loseLife', label: t('newGame.loseLife') },
              { value: 'nothing', label: t('newGame.nothing') },
            ]}
          />
          <Text variant="caption" tone="muted">
            {tooFew ? t('newGame.killerNeedsTwo') : t('newGame.killerNumbers')}
          </Text>
        </Section>
      ) : null}
      <Button label={t('newGame.continue')} onPress={start} disabled={tooFew} testID="start-game" />
    </Screen>
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
}));
