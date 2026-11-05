// Root of Ton Up Capture (ADR 0012), the internal app for photographing and labelling visits
// for training. Built from this project with APP_VARIANT=capture, which points expo-router here
// instead of src/app; Ton Up's own bundle never includes these routes.
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { hydrateCapture, useCapture } from '@/features/capture-lab/store';
import i18next, { initI18n } from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';
import { FONT_ASSETS } from '@/theme/fonts';
import { themeName } from '@/theme/themes';
import { useApplyTheme } from '@/theme/ThemeSync';

SplashScreen.preventAutoHideAsync();
initI18n();
// Capture's own strings, kept out of Ton Up's resources so they don't ship in Ton Up.
i18next.addResourceBundle('en', 'capture', capture);
hydrateCapture();
// Ton Up's themes (docs/design/themes.md), all of them, picked in Capture's Settings. Set before
// the first draw so the saved one shows from the start.
{
  const { theme, appearance } = useCapture.getState();
  const system = Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  UnistylesRuntime.setTheme(themeName(theme, appearance === 'system' ? system : appearance));
}

export default function CaptureLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const ready = fontsLoaded || !!fontError;
  const theme = useCapture((s) => s.theme);
  const appearance = useCapture((s) => s.appearance);
  const mode = useApplyTheme(theme, appearance);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" options={{ gestureEnabled: false }} />
        <Stack.Screen name="label" options={{ gestureEnabled: false }} />
        <Stack.Screen name="photo/[id]" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
}));
