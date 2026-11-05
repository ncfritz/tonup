import { Stack } from 'expo-router';

/** Sessions (home) and a session's photos, pushed over it with the tab bar still there. */
export default function HomeStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
