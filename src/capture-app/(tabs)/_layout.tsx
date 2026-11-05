import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { useUnistyles } from 'react-native-unistyles';

import { TabBar } from '@/ui';

export const unstable_settings = { initialRouteName: '(home)' };

/**
 * Capture's tabs (docs/plan/capture-lab.md › Screens), on Ton Up's tab bar: Overview and Models,
 * Sessions in the middle as the board button (home), Runs and Settings. Sessions and Runs are
 * stacks (`(home)/`, `runs/`), so a session's photos and a run open over them with the bar still
 * there. (A tab hidden with `href: null` can't be navigated to, so screens live in the stacks.)
 */
export default function CaptureTabs() {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} home="(home)" />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.colors.bg } }}
    >
      <Tabs.Screen name="overview" options={{ title: t('tabs.overview') }} />
      <Tabs.Screen name="models" options={{ title: t('tabs.models') }} />
      <Tabs.Screen
        name="(home)"
        options={{ title: t('tabs.sessions'), tabBarLabel: t('tabs.sessionsButton') }}
      />
      <Tabs.Screen name="runs" options={{ title: t('tabs.runs') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
