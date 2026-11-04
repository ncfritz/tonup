// Root of Ton Up Capture (ADR 0012), the internal app for photographing and labelling visits
// for training. Built from this project with APP_VARIANT=capture, which points expo-router here
// instead of src/app; Ton Up's own bundle never includes these routes.
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import i18next, { initI18n } from '@/i18n';
import capture from '@/i18n/locales/en/capture.json';
import { FONT_ASSETS } from '@/theme/fonts';
import { themeName } from '@/theme/themes';

SplashScreen.preventAutoHideAsync();
initI18n();
// Capture's own strings, kept out of Ton Up's resources so they don't ship in Ton Up.
i18next.addResourceBundle('en', 'capture', capture);
// One fixed look for an internal tool: the Training theme, dark (docs/design/themes.md).
UnistylesRuntime.setTheme(themeName('training', 'dark'));

export default function CaptureLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
}));
