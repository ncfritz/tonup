import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

/**
 * Runs and a run, pushed over it with the tab bar still there. Each screen sits on the theme's background, so nothing else shows at the edges while
 * one slides over the other.
 */
export default function RunsStack() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}
    />
  );
}
