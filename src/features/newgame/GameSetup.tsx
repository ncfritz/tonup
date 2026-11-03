import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { rulesEntry, useRulesT } from '@/content/rules';
import { BOT_LEVELS, botLevel } from '@/domain/bot';
import type { PlayerRef } from '@/domain/darts';
import { Button, Pressable, Text } from '@/ui';

import { isBot, YOU_ID } from '../game/lineup';
import type { PresetId } from '../game/presets';

import type { OptionCard } from './options';

export interface LineupActions {
  rename: (i: number, name: string) => void;
  level: (i: number, delta: number) => void;
  remove: (i: number) => void;
  earlier: (i: number) => void;
  addGuest: () => void;
  addBot: () => void;
}

/**
 * New game, step 2 (docs/design/screens.md → New game): the game in a card, the players as
 * avatars, each setting in a card of its own, and Start.
 */
export function GameSetup({
  presetId,
  players,
  lineup,
  max,
  cards,
  notes,
  countError,
  canStart,
  onStart,
  onChangeGame,
  onRules,
}: {
  presetId: PresetId;
  players: PlayerRef[];
  lineup: LineupActions;
  max: number;
  cards: OptionCard[];
  notes: string[];
  countError: string | null;
  canStart: boolean;
  onStart: () => void;
  onChangeGame: () => void;
  onRules: () => void;
}) {
  const { t } = useTranslation('game');
  const rt = useRulesT();
  const name = rt.t(`games.${presetId}.name`);
  const family = rulesEntry(presetId)?.family;
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        {family ? (
          <Text variant="overline" tone="accent">
            {rt.t(`families.${family}`)}
          </Text>
        ) : null}
        <Text variant="heading" testID="setup-game">
          {name}
        </Text>
        <Text tone="muted">{rt.t(`games.${presetId}.summary`)}</Text>
        <View style={styles.links}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('newGame.rulesA11y', { game: name })}
            style={styles.link}
            onPress={onRules}
            testID="game-rules"
          >
            <Text variant="bodyStrong" tone="accent">
              {t('newGame.howToPlay')}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.link}
            onPress={onChangeGame}
            testID="change-game"
          >
            <Text variant="bodyStrong" tone="accent">
              {t('newGame.changeGame')}
            </Text>
          </Pressable>
        </View>
      </View>

      <PlayersCard players={players} lineup={lineup} max={max} error={countError} />

      {cards.map((c) => (
        <View key={c.key} style={styles.card}>
          <Text variant="overline" tone="muted">
            {c.title}
          </Text>
          <View accessibilityRole="radiogroup" accessibilityLabel={c.title} style={styles.choices}>
            {c.options.map((o) => {
              const on = o.value === c.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={({ pressed }) => [
                    styles.choice,
                    on && styles.choiceOn,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => c.onChange(o.value)}
                  testID={`opt-${c.key}-${o.value}`}
                >
                  <Text variant="bodyStrong" tone={on ? 'onAccent' : 'text'} numberOfLines={1}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {c.note ? (
            <Text variant="caption" tone="muted">
              {c.note}
            </Text>
          ) : null}
        </View>
      ))}
      {notes.map((n) => (
        <Text key={n} variant="caption" tone="muted">
          {n}
        </Text>
      ))}

      <Button
        label={t('newGame.startGame', { game: name })}
        onPress={onStart}
        disabled={!canStart}
        testID="start-game"
      />
    </View>
  );
}

/** Initials for an avatar: YOU, a bot's level, a guest's first letter. */
function initials(p: PlayerRef): string {
  if (p.id === YOU_ID) return 'YOU';
  if (isBot(p)) return `B${p.botLevel}`;
  return (p.name.trim()[0] ?? '?').toUpperCase();
}

function PlayersCard({
  players,
  lineup,
  max,
  error,
}: {
  players: PlayerRef[];
  lineup: LineupActions;
  max: number;
  error: string | null;
}) {
  const { t } = useTranslation('game');
  const { theme } = useUnistyles();
  const [selected, setSelected] = useState<number | null>(null);
  const sel = selected !== null && selected < players.length ? selected : null;
  const p = sel === null ? null : players[sel]!;
  const full = players.length >= max;
  return (
    <View style={styles.card}>
      <Text variant="overline" tone="muted">
        {t('newGame.playersCount', { count: players.length })}
      </Text>
      <View style={styles.avatars}>
        {players.map((q, i) => {
          const on = sel === i;
          return (
            <Pressable
              key={`${q.id}-${i}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t('newGame.playerA11y', { name: q.name, n: i + 1 })}
              style={styles.avatarWrap}
              onPress={() => setSelected(on ? null : i)}
              testID={`player-${i}`}
            >
              <View style={[styles.avatar, i === 0 && styles.avatarFirst, on && styles.avatarOn]}>
                <Text variant="value" tone={i === 0 ? 'onAccent' : 'text'}>
                  {initials(q)}
                </Text>
              </View>
              <Text variant="caption" numberOfLines={1} style={styles.avatarName}>
                {q.name}
              </Text>
            </Pressable>
          );
        })}
        {full ? null : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('newGame.addPlayer')}
              style={styles.avatarWrap}
              onPress={lineup.addGuest}
              testID="add-player"
            >
              <View style={[styles.avatar, styles.avatarAdd]}>
                <Text variant="title" tone="muted">
                  +
                </Text>
              </View>
              <Text variant="caption" tone="muted">
                {t('newGame.player')}
              </Text>
            </Pressable>
            {players.filter(isBot).length < BOT_LEVELS.length ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('newGame.addBot')}
                style={styles.avatarWrap}
                onPress={lineup.addBot}
                testID="add-bot"
              >
                <View style={[styles.avatar, styles.avatarAdd]}>
                  <Text variant="bodyStrong" tone="muted">
                    {t('newGame.botShort')}
                  </Text>
                </View>
                <Text variant="caption" tone="muted">
                  {t('newGame.bot')}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
      {full ? (
        <Text variant="caption" tone="muted">
          {t('newGame.maxPlayers', { max })}
        </Text>
      ) : null}
      {p && sel !== null ? (
        <View style={styles.editor} testID="player-editor">
          {isBot(p) ? (
            <View style={styles.editRow}>
              <View style={styles.flex}>
                <Text variant="title">{p.name}</Text>
                <Text variant="caption" tone="muted">
                  {t('players.botLevel', {
                    level: p.botLevel,
                    average: botLevel(p.botLevel!).targetAverage,
                  })}
                </Text>
              </View>
              <Small label="−" a11y={t('newGame.easier')} onPress={() => lineup.level(sel, -1)} />
              <Small label="+" a11y={t('newGame.harder')} onPress={() => lineup.level(sel, 1)} />
            </View>
          ) : p.id === YOU_ID ? (
            <Text variant="title">{p.name}</Text>
          ) : (
            <TextInput
              value={p.name}
              onChangeText={(n) => lineup.rename(sel, n)}
              accessibilityLabel={t('newGame.nameLabel', { n: sel + 1 })}
              style={[styles.nameInput, theme.type.title, { color: theme.colors.text }]}
              maxLength={24}
              returnKeyType="done"
              testID="player-name"
            />
          )}
          <View style={styles.editRow}>
            {sel > 0 ? (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('newGame.earlier')}
                  onPress={() => {
                    lineup.earlier(sel);
                    setSelected(sel - 1);
                  }}
                  testID="player-earlier"
                />
              </View>
            ) : (
              <Text variant="caption" tone="muted" style={styles.flex}>
                {t('newGame.throwsFirstLine')}
              </Text>
            )}
            {players.length > 1 ? (
              <View style={styles.flex}>
                <Button
                  kind="secondary"
                  label={t('newGame.removeShort')}
                  accessibilityLabel={t('newGame.remove', { name: p.name })}
                  onPress={() => {
                    lineup.remove(sel);
                    setSelected(null);
                  }}
                  testID="player-remove"
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
      {error ? (
        <Text variant="caption" tone="danger" testID="player-count">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function Small({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
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
  wrap: { gap: theme.spacing.m },
  flex: { flex: 1 },
  hero: {
    gap: theme.spacing.xs,
    padding: theme.spacing.l,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surface2,
  },
  links: { flexDirection: 'row', gap: theme.spacing.l },
  link: { minHeight: 44, justifyContent: 'center' },
  card: {
    gap: theme.spacing.s,
    padding: theme.spacing.m + 2,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surface,
  },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs + 2 },
  choice: {
    flexGrow: 1,
    flexBasis: 0,
    minWidth: 64,
    minHeight: 48,
    paddingHorizontal: theme.spacing.s,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radii.m,
    borderWidth: 1.5,
    borderColor: theme.colors.line,
  },
  choiceOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.s },
  avatarWrap: { width: 68, alignItems: 'center', gap: theme.spacing.xs },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.line,
  },
  avatarFirst: { backgroundColor: theme.colors.accent },
  avatarOn: { borderWidth: 3, borderColor: theme.colors.text },
  avatarAdd: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.line,
  },
  avatarName: { maxWidth: 68 },
  editor: {
    gap: theme.spacing.s,
    padding: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface2,
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  nameInput: { minHeight: 44 },
  small: {
    width: 44,
    height: 44,
    borderRadius: theme.radii.s,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.85 },
}));
