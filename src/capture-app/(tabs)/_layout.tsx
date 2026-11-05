import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/ui';

export const unstable_settings = { initialRouteName: 'index' };

/**
 * Capture's tabs (docs/plan/capture-lab.md › Screens), on Ton Up's tab bar: Overview and Models,
 * Sessions in the middle as the board button (home), Runs and Settings. A session's photos open
 * under Sessions, with the bar still there.
 */
export default function CaptureTabs() {
  const { t } = useTranslation('capture');
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="overview" options={{ title: t('tabs.overview') }} />
      <Tabs.Screen name="models" options={{ title: t('tabs.models') }} />
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.sessions'), tabBarLabel: t('tabs.sessionsButton') }}
      />
      <Tabs.Screen name="runs" options={{ title: t('tabs.runs') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
      {/* A session's photos: under Sessions, with the bar, but not a tab of its own. */}
      <Tabs.Screen name="sessions/[id]" options={{ title: t('tabs.sessions'), href: null }} />
      {/* A run: under Runs, likewise. */}
      <Tabs.Screen name="runs/[id]" options={{ title: t('tabs.runs'), href: null }} />
    </Tabs>
  );
}
