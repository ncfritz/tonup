import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Shell } from '~/components/Shell';

import './globals.css';

export const metadata: Metadata = {
  title: 'Ton Up Lab',
  description: 'Training data, runs and models for Ton Up snap to score',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <Shell>{children}</Shell>
        </AntdRegistry>
      </body>
    </html>
  );
}
