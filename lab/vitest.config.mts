import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '~': path.join(import.meta.dirname, 'src'),
      '@domain': path.join(import.meta.dirname, '..', 'src', 'domain'),
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
