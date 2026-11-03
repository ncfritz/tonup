import common from './locales/en/common.json';
import game from './locales/en/game.json';
import history from './locales/en/history.json';
import practice from './locales/en/practice.json';
import rules from './locales/en/rules.json';
import settings from './locales/en/settings.json';

/** English is the source language; other languages mirror these namespaces. */
export const enResources = { common, game, practice, history, rules, settings } as const;

export const resources = { en: enResources };

export const namespaces = Object.keys(enResources) as (keyof typeof enResources)[];
