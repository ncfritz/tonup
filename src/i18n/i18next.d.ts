import 'i18next';

import type capture from './locales/en/capture.json';
import type { enResources } from './resources';

// Typed keys: unknown keys fail type-checking. The rules text is long prose with lists, which
// makes typed keys too deep for the compiler, so it is read through useRulesT
// (src/content/rules.ts) and checked by tests instead (src/content/rules.test.ts).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    // Ton Up Capture's strings are added at runtime by its own layout (src/capture-app), so they
    // never ship in Ton Up's bundle; they are typed here like the rest.
    resources: Omit<typeof enResources, 'rules'> & { capture: typeof capture };
  }
}
