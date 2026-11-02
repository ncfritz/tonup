import { randomUUID } from 'expo-crypto';

import type { PlayerRef } from '@/domain/darts';

/** The phone's owner. One stable id so their history is one player across games. */
export const YOU_ID = 'you';
export const MAX_PLAYERS = 6;

/** Bots are one player per level, so each level's history is kept together. */
export const botId = (level: number) => `bot-${level}`;

export const newGuest = (name: string): PlayerRef => ({ id: randomUUID(), name });

export const isBot = (p: PlayerRef) => p.botLevel !== undefined;

/** "Best of 5" is first to 3. */
export const firstTo = (bestOf: number) => Math.floor(bestOf / 2) + 1;
export const bestOf = (firstToN: number) => firstToN * 2 - 1;
