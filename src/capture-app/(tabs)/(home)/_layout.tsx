import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

/**
 * Sessions (home) and a session's photos, pushed over it with the tab bar still there. Each screen sits on the theme's background, so nothing else shows at the edges while
 * one slides over the other.
 */
export default function HomeStack() {
  const { theme } = useUnistyles();
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}
    />
  );
}
