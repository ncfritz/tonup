import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/ui';

export const unstable_settings = { initialRouteName: 'index' };

export default function TabsLayout() {
  const { t } = useTranslation();
  // Order matches the design: Practice · History · Play · Rules · Settings. Play is home.
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="practice" options={{ title: t('tabs.practice') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.play'), tabBarLabel: t('play.buttonLabel') }}
      />
      <Tabs.Screen name="rules" options={{ title: t('tabs.rules') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
    </Tabs>
  );
}
