import common from './locales/en/common.json';

/** English is the source language; other languages mirror these namespaces. */
export const enResources = { common } as const;

export const resources = { en: enResources };

export const namespaces = Object.keys(enResources) as (keyof typeof enResources)[];
