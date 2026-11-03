import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from '@expo-google-fonts/barlow-condensed';
import { useFonts } from 'expo-font';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { configurePro, hydratePro } from '@/features/pro/pro';
import { ProSync } from '@/features/pro/ProSync';
import { setSettingsPersistence, useSettings } from '@/features/settings/store';
import { initI18n } from '@/i18n';
import { DatabaseProvider } from '@/services/db/DatabaseProvider';
import { readAllSettings, writeSetting } from '@/services/db/settingsRepo';
import { log, pruneLog } from '@/services/diagnostics';
import { ThemeSync } from '@/theme/ThemeSync';
import { Button, Screen, Text } from '@/ui';

SplashScreen.preventAutoHideAsync();
// Synchronous with bundled resources, so screens can translate on first render.
initI18n();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <DatabaseProvider fallback={null} onError={(error) => <StartupError error={error} />}>
        <Bootstrap>
          <ThemeSync />
          <ThemedStatusBar />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="new-game" options={{ presentation: 'modal' }} />
            <Stack.Screen name="game/[sessionId]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="summary/[sessionId]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="replay/[sessionId]" />
            <Stack.Screen name="drill/[sessionId]" options={{ gestureEnabled: false }} />
            <Stack.Screen name="rules/[gameId]" />
            <Stack.Screen name="rules/checkouts" />
            <Stack.Screen name="rules/board" />
            <Stack.Screen name="rules/glossary" />
            <Stack.Screen name="pro" options={{ presentation: 'modal' }} />
          </Stack>
          <ProSync />
        </Bootstrap>
      </DatabaseProvider>
    </GestureHandlerRootView>
  );
}

/** Runs once after migrations: settings from SQLite with write-through, then log pruning. */
function Bootstrap({ children }: { children: ReactNode }) {
  const [ready] = useState(() => {
    const stored = readAllSettings();
    useSettings.getState().hydrate(stored);
    setSettingsPersistence(writeSetting);
    hydratePro(stored);
    configurePro({ persist: writeSetting });
    try {
      pruneLog();
    } catch (e) {
      log('warn', 'pruneLog failed', { error: String(e) });
    }
    return true;
  });
  return ready ? children : null;
}

function StartupError({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="heading" accessibilityRole="header">
        {t('error.startupTitle')}
      </Text>
      <Text tone="muted">{t('error.startupBody')}</Text>
      <Text variant="caption" tone="muted">
        {error.message}
      </Text>
    </Screen>
  );
}

function ThemedStatusBar() {
  const { rt } = useUnistyles();
  return <StatusBar style={rt.themeName?.endsWith('-light') ? 'dark' : 'light'} />;
}

/** Error screen for any route: try again or go back to Play. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  log('error', 'Route error boundary', {
    message: error.message,
    stack: error.stack?.slice(0, 2000),
  });
  return <Oops retry={retry} />;
}

function Oops({ retry }: { retry: () => Promise<void> }) {
  const { t } = useTranslation();
  return (
    <Screen edges={['top', 'bottom']}>
      <Text variant="heading" accessibilityRole="header">
        {t('error.title')}
      </Text>
      <Text tone="muted">{t('error.body')}</Text>
      <Button label={t('error.tryAgain')} onPress={() => retry()} />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
}));
