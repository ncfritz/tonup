import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Whether VoiceOver is on, kept up to date while the screen is open. */
export function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    void Promise.resolve(AccessibilityInfo.isScreenReaderEnabled()).then((v) => {
      if (live) setOn(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}
