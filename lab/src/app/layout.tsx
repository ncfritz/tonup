import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { COLOR_MODE_SCRIPT } from '~/components/colorMode';
import { Shell } from '~/components/Shell';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ton Up Lab',
  description: 'Training data, runs and models for Ton Up snap to score',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The mode is set on <html> before paint (and by the app after), so it differs from the server's.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} />
      </head>
      <body>
        <AntdRegistry>
          <Shell>{children}</Shell>
        </AntdRegistry>
      </body>
    </html>
  );
}
