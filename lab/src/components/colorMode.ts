'use client';

import { useSyncExternalStore } from 'react';

import { PREF, readPref, subscribePrefs, useInitialPrefs, writePref } from './prefs';

// Light, dark, or the system's choice, per browser (a cookie, so the server draws it too).
// `useDark` follows the system's setting live when the choice is "system".
export type ColorMode = 'system' | 'light' | 'dark';

const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function readMode(): ColorMode {
  const v = readPref(PREF.mode);
  return v === 'light' || v === 'dark' ? v : 'system';
}

export const setColorMode = (mode: ColorMode) =>
  writePref(PREF.mode, mode === 'system' ? null : mode);

function subscribe(l: () => void) {
  const off = subscribePrefs(l);
  const q = query();
  q.addEventListener('change', l);
  return () => {
    off();
    q.removeEventListener('change', l);
  };
}

export function useColorMode() {
  const initial = useInitialPrefs();
  return useSyncExternalStore(subscribe, readMode, () => initial.mode);
}

export function useDark() {
  const initial = useInitialPrefs();
  return useSyncExternalStore(
    subscribe,
    () => {
      const m = readMode();
      return m === 'dark' || (m === 'system' && query().matches);
    },
    () => initial.dark,
  );
}
