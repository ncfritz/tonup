import common from './locales/en/common.json';
import game from './locales/en/game.json';
import practice from './locales/en/practice.json';

/** English is the source language; other languages mirror these namespaces. */
export const enResources = { common, game, practice } as const;

export const resources = { en: enResources };

export const namespaces = Object.keys(enResources) as (keyof typeof enResources)[];
