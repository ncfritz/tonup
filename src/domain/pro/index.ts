// What's in the base app and what Ton Up Pro unlocks (ADR 0009). Pure rules; the app supplies
// whether Pro is owned. Locked things stay visible and lead to the Pro screen.

/** The Pro product in App Store Connect: a one-time, non-consumable in-app purchase. */
export const PRO_PRODUCT_ID = 'app.tonup.pro';
/** The price set in App Store Connect; the screen shows StoreKit's localized price when it can. */
export const PRO_PRICE_USD = '19.99';

/** Games in the base app (by game id, and Cricket by variant). Everything else is Pro. */
const BASE_GAMES = new Set(['x01', 'cricket', 'clock', 'shanghai', 'killer']);
const BASE_CRICKET = new Set(['standard', 'cutThroat']);
/** Rules-library ids that are base games. */
const BASE_RULES = new Set(['x01', 'cricket', 'cutThroat', 'clock', 'shanghai', 'killer']);
const BASE_DRILLS = new Set(['bobs27', 'countUp', 'clock']);
const BASE_THEMES = new Set(['pro']);

export function canPlayGame(gameId: string, pro: boolean, variant?: string): boolean {
  if (pro) return true;
  if (!BASE_GAMES.has(gameId)) return false;
  if (gameId === 'cricket') return variant === undefined || BASE_CRICKET.has(variant);
  if (gameId === 'killer') return variant === undefined || variant === 'classic';
  return true;
}

/**
 * Whether a game in the rules library can be played, by its rules id (which is also its preset:
 * src/features/game/presets.ts). Its rules are always readable.
 */
export const canPlayRules = (rulesId: string, pro: boolean) => pro || BASE_RULES.has(rulesId);

export const canUseDrill = (drillId: string, pro: boolean) => pro || BASE_DRILLS.has(drillId);

export const canUseTheme = (themeId: string, pro: boolean) => pro || BASE_THEMES.has(themeId);

/** Aim-relative heatmap, drift and grouping, aim map, trends, ghost bot (M13). */
export const canUseAnalysis = (pro: boolean) => pro;

/** Camera scoring is Pro when it ships (ADR 0005, 0009). */
export const canUseCamera = (pro: boolean) => pro;

/** The theme to fall back to when Pro is refunded or was never bought. */
export const BASE_THEME = 'pro';
