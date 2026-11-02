import * as Haptics from 'expo-haptics';

import { useSettings } from '@/features/settings/store';

/** Haptics that respect the user's setting. */
const enabled = () => useSettings.getState().haptics;

export const haptics = {
  selection: () => enabled() && Haptics.selectionAsync(),
  light: () => enabled() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  success: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => enabled() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};
