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
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { initI18n } from '@/i18n';
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
      <ThemeSync />
      <ThemedStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { rt } = useUnistyles();
  return <StatusBar style={rt.themeName?.endsWith('-light') ? 'dark' : 'light'} />;
}

/** Error screen for any route: try again or go back to Play. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
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
