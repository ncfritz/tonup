import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import { COLOR_MODE_SCRIPT, PREF, type InitialPrefs } from '~/components/prefKeys';
import { Shell } from '~/components/Shell';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ton Up Lab',
  description: 'Training data, runs and models for Ton Up snap to score',
};

/** The browser's choices, from its cookies, so the page is drawn as it was left. */
async function initialPrefs(): Promise<InitialPrefs> {
  const jar = await cookies();
  const get = (name: string) => jar.get(name)?.value ?? null;
  const mode = get(PREF.mode);
  const sides: Record<string, boolean> = {};
  for (const c of jar.getAll()) {
    const m = /^tonup-lab\.side\.(.+)$/.exec(c.name);
    if (m) sides[m[1]!] = c.value === '1';
  }
  return {
    mode: mode === 'light' || mode === 'dark' ? mode : 'system',
    dark: mode === 'dark' || (mode !== 'light' && get(PREF.dark) === '1'),
    sides,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initial = await initialPrefs();
  return (
    // The mode is set on <html> before paint (and by the app after), so it differs from the server's.
    <html lang="en" data-theme={initial.dark ? 'dark' : 'light'} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />
      </head>
      <body>
        <AntdRegistry>
          <Shell initial={initial}>{children}</Shell>
        </AntdRegistry>
      </body>
    </html>
  );
}
