import path from 'node:path';

import type { NextConfig } from 'next';

// Lab shares the app's plain-TypeScript domain code (board geometry and scoring) from ../src/domain,
// so it checks labels exactly as the phone does (ADR 0012). That folder is outside lab/, so the
// bundler's root is the repository.
const repo = path.join(__dirname, '..');

const config: NextConfig = {
  turbopack: { root: repo },
  outputFileTracingRoot: repo,
  experimental: { externalDir: true },
  // Native module; loaded by Node at runtime, never bundled.
  serverExternalPackages: ['better-sqlite3'],
};

export default config;
