// Names and shapes of Lab's per-browser choices, for the server (app/layout.tsx) and the
// browser (prefs.ts, colorMode.ts) alike: no 'use client' here, so the server gets the values.
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

/**
 * Run before the page paints (app/layout.tsx): marks <html> with the mode about to be drawn,
 * and notes whether that's dark, so the server can draw "system" right on the next load.
 */
export const COLOR_MODE_SCRIPT = `(function(){try{var c=document.cookie.split('; ').find(function(x){return x.indexOf('${PREF.mode}=')===0});var m=c?c.split('=')[1]:'system';var d=m==='dark'||(m!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.cookie='${PREF.dark}='+(d?1:0)+'; path=/; max-age=31536000; samesite=lax';}catch(e){}})();`;
