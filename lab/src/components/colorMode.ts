'use client';

import { useSyncExternalStore } from 'react';

// Light, dark, or the system's choice, per browser (localStorage). `useDark` follows the
// system's setting live when the choice is "system".
export type ColorMode = 'system' | 'light' | 'dark';
export const COLOR_MODE_KEY = 'tonup-lab.color-mode';

const listeners = new Set<() => void>();
const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function readMode(): ColorMode {
  try {
    const v = window.localStorage.getItem(COLOR_MODE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setColorMode(mode: ColorMode) {
  try {
    if (mode === 'system') window.localStorage.removeItem(COLOR_MODE_KEY);
    else window.localStorage.setItem(COLOR_MODE_KEY, mode);
  } catch {
    // Storage blocked: it holds for this page only.
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener('storage', l);
  const q = query();
  q.addEventListener('change', l);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', l);
    q.removeEventListener('change', l);
  };
}

export const useColorMode = () => useSyncExternalStore(subscribe, readMode, () => 'system');

export function useDark() {
  return useSyncExternalStore(
    subscribe,
    () => {
      const m = readMode();
      return m === 'dark' || (m === 'system' && query().matches);
    },
    () => false,
  );
}

/**
 * Run before the page paints (app/layout.tsx), so a dark page doesn't flash white while the
 * app loads: marks <html> with the mode the app is about to draw.
 */
export const COLOR_MODE_SCRIPT = `(function(){try{var m=localStorage.getItem('${COLOR_MODE_KEY}');var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;
