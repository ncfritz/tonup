import { Stack } from 'expo-router';

/** Runs and a run, pushed over it with the tab bar still there. */
export default function RunsStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
