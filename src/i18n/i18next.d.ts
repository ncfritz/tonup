import 'i18next';

import type { enResources } from './resources';

// Typed keys: unknown keys fail type-checking.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: typeof enResources;
  }
}
