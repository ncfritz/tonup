import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FAMILIES, matches, RULES, useRulesT } from '@/content/rules';
import { canPlayRules } from '@/domain/pro';
import { Icon, Pressable, Text } from '@/ui';

import { MAX_PLAYERS } from '../game/lineup';
import { PRESETS, type PresetId } from '../game/presets';

import { playerRange } from './options';
import type { Setup } from './recent';

/**
 * New game, step 1 (docs/design/screens.md → New game): search, Play again, then every game as
 * a full-width button by family, with its one-line summary and how many it's for.
 */
export function GamePicker({
  proOwned,
  recent,
  search = true,
  describe,
  onPick,
  onAgain,
  onLocked,
}: {
  proOwned: boolean;
  recent: Setup[];
  /** The search box; Play shows the list without it. */
  search?: boolean;
  /** "Best of 5 · vs DartBot 3" for a Play again button. */
  describe: (s: Setup) => string;
  onPick: (id: PresetId) => void;
  onAgain: (s: Setup) => void;
  onLocked: () => void;
}) {
  const { t } = useTranslation('game');
  const rt = useRulesT();
  const { theme } = useUnistyles();
  const [query, setQuery] = useState('');
  const name = (id: string) => rt.t(`games.${id}.name`);
  const summary = (id: string) => rt.t(`games.${id}.summary`);
  const shown = RULES.filter((r) => matches(query, name(r.id), summary(r.id)));

  return (
    <View style={styles.wrap}>
      {search ? (
        <View style={styles.search}>
          <Icon name="search" color={theme.colors.muted} size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('newGame.search', { count: RULES.length })}
            placeholderTextColor={theme.colors.muted}
            accessibilityLabel={t('newGame.searchA11y')}
            autoCorrect={false}
            clearButtonMode="while-editing"
            style={[styles.searchInput, theme.type.body, { color: theme.colors.text }]}
            testID="game-search"
          />
        </View>
      ) : null}

      {query === '' && recent.length > 0 ? (
        <View style={styles.group}>
          <Text variant="overline" tone="accent">
            {t('newGame.again')}
          </Text>
          <View style={styles.again}>
            {recent.map((s, i) => (
              <Pressable
                key={i}
                accessibilityRole="button"
                accessibilityLabel={t('newGame.againA11y', {
                  game: name(s.presetId),
                  setup: describe(s),
                })}
                style={({ pressed }) => [
                  styles.againButton,
                  i === 0 && styles.againFirst,
                  pressed && styles.pressed,
                ]}
                onPress={() => onAgain(s)}
                testID={`again-${i}`}
              >
                <Text variant="title" numberOfLines={1}>
                  {s.presetId === 'x01' ? String(s.settings.startScore ?? 501) : name(s.presetId)}
                </Text>
                <Text variant="caption" tone="muted" numberOfLines={2}>
                  {describe(s)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {FAMILIES.map((f) => {
        const games = shown.filter((r) => r.family === f);
        if (games.length === 0) return null;
        return (
          <View key={f} style={styles.group}>
            <Text variant="overline" tone="muted">
              {rt.t(`families.${f}`)}
            </Text>
            {games.map((r) => {
              const id = r.id as PresetId;
              const open = canPlayRules(id, proOwned);
              return (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityLabel={open ? name(id) : t('newGame.lockedA11y', { game: name(id) })}
                  accessibilityHint={summary(id)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={() => (open ? onPick(id) : onLocked())}
                  testID={`pick-${id}`}
                >
                  <View style={styles.flex}>
                    <Text variant="title">{name(id)}</Text>
                    <Text variant="caption" tone="muted">
                      {summary(id)}
                    </Text>
                  </View>
                  {open ? (
                    <>
                      <Text variant="caption" tone="muted">
                        {playerRange(PRESETS[id].players, MAX_PLAYERS)}
                      </Text>
                      <Icon name="chevron" color={theme.colors.muted} size={16} />
                    </>
                  ) : (
                    <View style={styles.pro}>
                      <Icon name="lock" color={theme.colors.accent} size={12} />
                      <Text variant="overline" tone="accent" style={styles.proText}>
                        {t('newGame.proTag')}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        );
      })}
      {shown.length === 0 ? <Text tone="muted">{t('newGame.noMatch', { query })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.l },
  flex: { flex: 1, gap: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.s,
    minHeight: 44,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
  },
  searchInput: { flex: 1, minHeight: 44 },
  group: { gap: theme.spacing.xs + 2 },
  again: { flexDirection: 'row', gap: theme.spacing.s },
  againButton: {
    flex: 1,
    minHeight: 64,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.l,
    borderWidth: 2,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  againFirst: { borderColor: theme.colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    minHeight: 64,
    paddingVertical: theme.spacing.s,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  pro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
    paddingHorizontal: theme.spacing.s,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface2,
  },
  proText: { fontSize: 12, lineHeight: 14 },
  pressed: { opacity: 0.85 },
}));
