// The two apps built from this project (ADR 0012): what each variant's config sets, and that no
// Ton Up code reaches into Ton Up Capture's routes or features.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import appConfig, { appVariant } from '../app.config';
import { enResources } from './i18n/resources';

function configFor(variant: string | undefined) {
  const saved = process.env.APP_VARIANT;
  if (variant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = variant;
  try {
    return appConfig({ config: {} } as Parameters<typeof appConfig>[0]);
  } finally {
    if (saved === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = saved;
  }
}

const pluginNames = (c: ReturnType<typeof configFor>) =>
  (c.plugins ?? []).map((p) => (Array.isArray(p) ? p[0] : p));
const routerRoot = (c: ReturnType<typeof configFor>) =>
  (c.plugins ?? []).find((p) => Array.isArray(p) && p[0] === 'expo-router')?.[1]?.root;

describe('app variants', () => {
  it('defaults to Ton Up', () => {
    expect(appVariant(undefined)).toBe('tonup');
    expect(appVariant('anything')).toBe('tonup');
    expect(appVariant('capture')).toBe('capture');
  });

  it('Ton Up keeps its bundle ID, routes, Pro and Files sharing', () => {
    const c = configFor(undefined);
    expect(c.name).toBe('Ton Up');
    expect(c.ios?.bundleIdentifier).toBe('app.tonup.ios');
    expect(routerRoot(c)).toBe('src/app');
    expect(pluginNames(c)).toEqual(expect.arrayContaining(['expo-iap', 'expo-sqlite']));
    expect(c.ios?.infoPlist?.UIFileSharingEnabled).toBe(true);
    expect(c.ios?.infoPlist?.NSAppTransportSecurity).toBeUndefined();
  });

  it('Capture has its own app, routes and local-network access, and no Pro', () => {
    const c = configFor('capture');
    expect(c.name).toBe('TU Capture');
    expect(c.scheme).toBe('tonupcapture');
    expect(c.ios?.bundleIdentifier).toBe('app.tonup.ios.capture');
    expect(routerRoot(c)).toBe('src/capture-app');
    expect(pluginNames(c)).not.toContain('expo-iap');
    expect(pluginNames(c)).not.toContain('./plugins/with-storekit-config');
    expect(c.ios?.infoPlist?.NSAppTransportSecurity).toEqual({ NSAllowsLocalNetworking: true });
    expect(c.ios?.infoPlist?.NSLocalNetworkUsageDescription).toBeTruthy();
    expect(c.ios?.infoPlist?.UIFileSharingEnabled).toBeUndefined();
  });

  it('each variant writes itself into the Xcode environment', () => {
    for (const v of ['tonup', 'capture'] as const) {
      const c = configFor(v);
      const entry = (c.plugins ?? []).find(
        (p) => Array.isArray(p) && p[0] === './plugins/with-app-variant',
      );
      expect(entry?.[1]).toEqual({ variant: v });
    }
  });
});

describe('Ton Up code stays out of Capture', () => {
  const captureOnly = ['capture-app', join('features', 'capture-lab')];
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        return captureOnly.includes(relative(__dirname, p)) ? [] : files(p);
      }
      return /\.tsx?$/.test(p) ? [p] : [];
    });
  }

  it("Ton Up's translations don't include Capture's strings", () => {
    expect(Object.keys(enResources)).not.toContain('capture');
  });

  it('no file outside the Capture folders imports from them', () => {
    const offenders = files(__dirname).filter((f) =>
      /from '(@\/|\.\.?\/)[^']*(capture-app|features\/capture-lab)/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders.map((f) => relative(__dirname, f))).toEqual([]);
  });
});
