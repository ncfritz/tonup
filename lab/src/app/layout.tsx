import { AntdRegistry } from '@ant-design/nextjs-registry';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Shell } from '~/components/Shell';

export const metadata: Metadata = {
  title: 'Ton Up Lab',
  description: 'Training data, runs and models for Ton Up snap to score',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AntdRegistry>
          <Shell>{children}</Shell>
        </AntdRegistry>
      </body>
    </html>
  );
}
