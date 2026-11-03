import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { useRulesT } from '@/content/rules';
import { FlatList, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BOGEY_NUMBERS, checkoutRoute } from '@/domain/checkout';
import { label } from '@/domain/darts';
import { Header, Screen, Text } from '@/ui';

/** Every finish from 170 down to 2 (docs/design/screens.md → Rules › Checkouts). */
export default function Checkouts() {
  const { t } = useRulesT();
  const { theme } = useUnistyles();
  const [q, setQ] = useState('');
  const rows = useMemo(
    () =>
      Array.from({ length: 169 }, (_, i) => 170 - i).map((score) => ({
        score,
        route: checkoutRoute(score, 3)?.map(label) ?? null,
      })),
    [],
  );
  const shown = q.trim() ? rows.filter((r) => String(r.score).startsWith(q.trim())) : rows;
  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={t('checkouts.title')}
        backLabel={t('page.back')}
        onBack={() => router.back()}
      />
      <Text tone="muted">{t('checkouts.intro')}</Text>
      <Text variant="caption" tone="muted">
        {t('checkouts.bogey', { list: BOGEY_NUMBERS.join(', ') })}
      </Text>
      <TextInput
        value={q}
        onChangeText={(v) => setQ(v.replace(/\D/g, ''))}
        keyboardType="number-pad"
        placeholder={t('checkouts.search')}
        placeholderTextColor={theme.colors.muted}
        accessibilityLabel={t('checkouts.search')}
        style={[styles.search, theme.type.body, { color: theme.colors.text }]}
        maxLength={3}
        testID="checkout-search"
      />
      <FlatList
        data={shown}
        keyExtractor={(r) => String(r.score)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View
            style={styles.row}
            accessible
            accessibilityLabel={t('checkouts.route', {
              score: item.score,
              route: item.route ? item.route.join(', ') : t('checkouts.none'),
            })}
          >
            <Text variant="title" style={styles.score}>
              {item.score}
            </Text>
            <Text variant="bodyStrong" tone={item.route ? 'text' : 'muted'} style={styles.route}>
              {item.route ? item.route.join('  ') : t('checkouts.none')}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  search: {
    minHeight: 44,
    borderRadius: theme.radii.m,
    paddingHorizontal: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
  list: { gap: 4, paddingBottom: theme.spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.s,
    paddingHorizontal: theme.spacing.m,
    minHeight: 40,
  },
  score: { width: 48 },
  route: { flex: 1 },
}));
