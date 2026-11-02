import * as Speech from 'expo-speech';

import { useSettings } from '@/features/settings/store';

/** The caller: reads out a visit on the phone (no network), when switched on in Settings. */
export function call(text: string) {
  if (!useSettings.getState().caller) return;
  Speech.stop();
  Speech.speak(text, { language: 'en-GB', rate: 1.0, pitch: 0.95 });
}
