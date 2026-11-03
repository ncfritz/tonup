import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { buyPro, loadProProduct, restorePro, usePro } from '@/features/pro/pro';
import { Button, Header, Icon, Screen, Text } from '@/ui';

type Item = { title: string; body: string };

/** The Pro screen (docs/design/screens.md → Pro upgrade), opened from every lock. */
export default function Pro() {
  const { t } = useTranslation('pro');
  const { theme } = useUnistyles();
  const owned = usePro((s) => s.owned);
  const product = usePro((s) => s.product);
  const loading = usePro((s) => s.loadingProduct);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void loadProProduct();
  }, []);
  const items = t('items', { returnObjects: true }) as Item[];

  const buy = async () => {
    setBusy(true);
    setMessage(null);
    const r = await buyPro();
    setBusy(false);
    if (r !== 'cancelled') setMessage(t(`results.${r}`));
  };
  const restore = async () => {
    setBusy(true);
    setMessage(null);
    const r = await restorePro();
    setBusy(false);
    setMessage(
      r === true
        ? t('results.restored')
        : r === false
          ? t('results.notFound')
          : t('results.restoreFailed'),
    );
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('title')} backLabel={t('close')} onBack={() => router.back()} />
      <View>
        <Text variant="heading" accessibilityRole="header">
          {owned ? t('owned') : t('title')}
        </Text>
        <Text tone="muted">{owned ? t('ownedBody') : t('tagline')}</Text>
      </View>
      <View style={styles.card}>
        <Text variant="overline" tone="muted">
          {t('includes')}
        </Text>
        {items.map((it) => (
          <View key={it.title} style={styles.item}>
            <Icon name="check" color={theme.colors.accent} size={20} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{it.title}</Text>
              <Text variant="caption" tone="muted">
                {it.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {owned ? null : (
        <>
          {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
          <Button
            label={product ? t('buy', { price: product.displayPrice }) : t('buyNoPrice')}
            disabled={busy || !product}
            onPress={() => void buy()}
            testID="buy-pro"
          />
          {!loading && !product ? <Text tone="muted">{t('unavailable')}</Text> : null}
          <Text variant="caption" tone="muted">
            {product?.familyShareable ? `${t('once')} ${t('family')}` : t('once')}
          </Text>
        </>
      )}
      <Button
        kind="secondary"
        label={t('restore')}
        disabled={busy}
        onPress={() => void restore()}
        testID="restore-pro"
      />
      {message ? (
        <Text tone="accent" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1, gap: 2 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.m,
  },
  item: { flexDirection: 'row', gap: theme.spacing.m },
}));
