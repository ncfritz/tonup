import { useEffect } from 'react';
import { AppState } from 'react-native';

import { refreshPro, startPro } from './pro';

/** Checks Pro with StoreKit at launch and on return to the foreground (refunds, family). */
export function ProSync() {
  useEffect(() => {
    let stop: () => void = () => {};
    let alive = true;
    void startPro().then((s) => (alive ? (stop = s) : s()));
    const sub = AppState.addEventListener(
      'change',
      (state) => state === 'active' && void refreshPro(),
    );
    return () => {
      alive = false;
      stop();
      sub.remove();
    };
  }, []);
  return null;
}
