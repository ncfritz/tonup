'use client';

import { createContext, useContext } from 'react';

/**
 * Lab's per-browser choices (the menu folded, the colour mode, side panels), kept in cookies
 * so the server draws the page as it was left: no flash of the defaults on a reload. The layout
 * reads them (app/layout.tsx) and hands them down; hooks use them as their first value.
 */
export const PREF = {
  collapsed: 'tonup-lab.pages-collapsed',
  mode: 'tonup-lab.color-mode',
  /** Whether the page is dark, as last worked out in the browser (for "system"). */
  dark: 'tonup-lab.dark',
  side: (id: string) => `tonup-lab.side.${id}`,
} as const;

export interface InitialPrefs {
  collapsed: boolean;
  mode: 'system' | 'light' | 'dark';
  dark: boolean;
  /** Side panels by ID: open or closed; missing means its default. */
  sides: Record<string, boolean>;
}

export const DEFAULT_PREFS: InitialPrefs = {
  collapsed: false,
  mode: 'system',
  dark: false,
  sides: {},
};

export const PrefsContext = createContext<InitialPrefs>(DEFAULT_PREFS);
export const useInitialPrefs = () => useContext(PrefsContext);

const YEAR = 60 * 60 * 24 * 365;

export function readPref(name: string): string | null {
  try {
    const hit = document.cookie
      .split('; ')
      .find((c) => c.startsWith(`${encodeURIComponent(name)}=`));
    if (hit) return decodeURIComponent(hit.slice(hit.indexOf('=') + 1));
    // Chosen before these moved to cookies.
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

/** Saves a choice (null forgets it); listeners hear about it. */
export function writePref(name: string, value: string | null) {
  try {
    document.cookie =
      value === null
        ? `${encodeURIComponent(name)}=; path=/; max-age=0; samesite=lax`
        : `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; samesite=lax`;
    window.localStorage.removeItem(name);
  } catch {
    // Cookies blocked: it holds for this page only.
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();
export function subscribePrefs(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
