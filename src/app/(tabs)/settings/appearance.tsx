import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { canUseTheme } from '@/domain/pro';
import { useProOwned } from '@/features/pro/pro';
import { useSettings, type AppearanceSetting } from '@/features/settings/store';
import { ThemeList } from '@/features/settings/ThemeList';
import { useMode } from '@/theme/ThemeSync';
import { Header, Screen, Section, SegmentedControl, Text } from '@/ui';

/** Settings › Appearance (docs/design/screens.md; the canvas's theme picker). */
export default function Appearance() {
  const { t } = useTranslation('settings');
  const appearance = useSettings((s) => s.appearance);
  const current = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const proOwned = useProOwned();
  const mode = useMode(appearance);

  return (
    <Screen scroll>
      <Header title={t('appearance.title')} backLabel={t('title')} onBack={() => router.back()} />
      <Section label={t('appearance.mode')}>
        <SegmentedControl<AppearanceSetting>
          accessibilityLabel={t('appearance.mode')}
          value={appearance}
          onChange={(v) => set('appearance', v)}
          segments={[
            { value: 'system', label: t('appearance.system') },
            { value: 'light', label: t('appearance.light') },
            { value: 'dark', label: t('appearance.dark') },
          ]}
        />
        <Text variant="caption" tone="muted">
          {t('appearance.modeNote')}
        </Text>
      </Section>
      <Section label={t('appearance.theme')}>
        <ThemeList
          value={current}
          mode={mode}
          locked={(id) => !canUseTheme(id, proOwned)}
          onPick={(id) => set('theme', id)}
          onLocked={() => router.push('/pro')}
        />
      </Section>
    </Screen>
  );
}
