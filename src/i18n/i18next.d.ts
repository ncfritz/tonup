import 'i18next';

import type { enResources } from './resources';

// Typed keys: unknown keys fail type-checking. The rules text is long prose with lists, which
// makes typed keys too deep for the compiler, so it is read through useRulesT
// (src/content/rules.ts) and checked by tests instead (src/content/rules.test.ts).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: Omit<typeof enResources, 'rules'>;
  }
}
