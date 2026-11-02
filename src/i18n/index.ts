import { createInstance } from 'i18next';
import ICU from 'i18next-icu';
import { initReactI18next } from 'react-i18next';

import { namespaces, resources } from './resources';

const i18next = createInstance();

/** English only at launch (ADR 0010); every user-facing string is still a key. */
export function initI18n() {
  return i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
      resources,
      lng: 'en',
      fallbackLng: 'en',
      ns: namespaces,
      defaultNS: 'common',
      interpolation: { escapeValue: false },
      returnNull: false,
      initAsync: false,
    });
}

export default i18next;
