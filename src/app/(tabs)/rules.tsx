import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FAMILIES, matches, RULES, useRulesT } from '@/content/rules';
import { Icon, Pressable, Screen, Section, Text } from '@/ui';

type Term = { term: string; def: string };

/** The Rules tab (docs/design/screens.md → Rules tab). */
export default function Rules() {
  const { t, list } = useRulesT();
  const { theme } = useUnistyles();
  const [q, setQ] = useState('');
  const name = (id: string) => t(`games.${id}.name`);
  const summary = (id: string) => t(`games.${id}.summary`);
  const shown = RULES.filter((r) => matches(q, name(r.id), summary(r.id)));
  const playable = shown.filter((r) => r.play);
  const others = shown.filter((r) => !r.play);
  const terms = list<Term>('glossary.terms').filter((g) => q.trim() && matches(q, g.term, g.def));
  const open = (id: string) => router.push({ pathname: '/rules/[gameId]', params: { gameId: id } });

  return (
    <Screen scroll>
      <Text variant="heading" accessibilityRole="header">
        {t('title')}
      </Text>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t('search')}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={t('searchA11y')}
        style={[styles.search, theme.type.body, { color: theme.colors.text }]}
        clearButtonMode="while-editing"
        autoCorrect={false}
        testID="rules-search"
      />
      {q.trim() ? null : (
        <View style={styles.quick}>
          {(['checkouts', 'board', 'glossary'] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
              onPress={() => router.push(`/rules/${k}`)}
            >
              <Text variant="bodyStrong">{t(`quick.${k}`)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {playable.length ? (
        <Section label={t('inApp')}>
          {playable.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => open(r.id)}
              testID={`rules-${r.id}`}
            >
              <Text variant="title">{name(r.id)}</Text>
              <Text variant="caption" tone="muted">
                {summary(r.id)}
              </Text>
            </Pressable>
          ))}
        </Section>
      ) : null}
      {others.length ? (
        <Section label={t('others')}>
          {FAMILIES.map((f) => {
            const inFamily = others.filter((r) => r.family === f);
            if (!inFamily.length) return null;
            return (
              <View key={f} style={styles.family}>
                <Text variant="caption" tone="muted">
                  {t(`families.${f}`)}
                </Text>
                <View style={styles.chips}>
                  {inFamily.map((r) => (
                    <Pressable
                      key={r.id}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => open(r.id)}
                      testID={`rules-${r.id}`}
                    >
                      <Icon name="lock" color={theme.colors.muted} size={14} />
                      <Text variant="bodyStrong">{name(r.id)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </Section>
      ) : null}
      {terms.length ? (
        <Section label={t('glossary.title')}>
          {terms.map((g) => (
            <View key={g.term} style={styles.row}>
              <Text variant="bodyStrong">{g.term}</Text>
              <Text tone="muted">{g.def}</Text>
            </View>
          ))}
        </Section>
      ) : null}
      {q.trim() && !shown.length && !terms.length ? (
        <Text tone="muted">{t('noResults', { q: q.trim() })}</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  search: {
    height: 44,
    borderRadius: theme.radii.m,
    paddingHorizontal: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
  quick: { flexDirection: 'row', gap: theme.spacing.s },
  quickButton: {
    flex: 1,
    height: 48,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    gap: 2,
  },
  family: { gap: theme.spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    height: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.85 },
}));
