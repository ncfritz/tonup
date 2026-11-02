import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useSettings, type AppearanceSetting } from '@/features/settings/store';
import { SegmentedControl, Text } from '@/ui';

/**
 * Developer controls, shown in Settings in dev builds only: appearance and haptics until the
 * real Settings screen exists (M9). Theme switching joins when the Pro themes land (M14).
 */
export function DevMenu() {
  const { t } = useTranslation();
  const appearance = useSettings((s) => s.appearance);
  const hapticsOn = useSettings((s) => s.haptics);
  const set = useSettings((s) => s.set);
  return (
    <View style={styles.wrap}>
      <Text variant="overline" tone="muted">
        {t('dev.title')}
      </Text>
      <Text variant="bodyStrong">{t('dev.appearance')}</Text>
      <SegmentedControl<AppearanceSetting>
        accessibilityLabel={t('dev.appearance')}
        value={appearance}
        onChange={(v) => set('appearance', v)}
        segments={[
          { value: 'system', label: t('dev.system') },
          { value: 'light', label: t('dev.light') },
          { value: 'dark', label: t('dev.dark') },
        ]}
      />
      <Text variant="bodyStrong">{t('dev.haptics')}</Text>
      <SegmentedControl
        accessibilityLabel={t('dev.haptics')}
        value={hapticsOn ? 'on' : 'off'}
        onChange={(v) => set('haptics', v === 'on')}
        segments={[
          { value: 'on', label: t('dev.on') },
          { value: 'off', label: t('dev.off') },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: theme.spacing.s, marginTop: theme.spacing.m },
}));
