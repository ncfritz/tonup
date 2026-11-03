import { create } from 'zustand';

import { BASE_THEME, canUseTheme, PRO_PRODUCT_ID } from '@/domain/pro';
import { useSettings } from '@/features/settings/store';
import { log } from '@/services/diagnostics';
import { purchases, type BuyResult, type StoreProduct } from '@/services/purchases';

/**
 * Ton Up Pro (ADR 0009): whether it's owned, its price, and buying or restoring it. StoreKit is
 * the source of truth; `pro.owned` in the settings table is only a cache so locks don't flash
 * at launch. It isn't part of backups.
 */

const CACHE_KEY = 'pro.owned';

interface ProState {
  owned: boolean;
  /** StoreKit answered at least once this session. */
  checked: boolean;
  product: StoreProduct | null;
  /** True while the price is being fetched; false with no product means the store isn't reachable. */
  loadingProduct: boolean;
}

export const usePro = create<ProState>(() => ({
  owned: false,
  checked: false,
  product: null,
  loadingProduct: false,
}));

let persist: (key: string, value: unknown) => void = () => {};
export function configurePro(options: { persist: (key: string, value: unknown) => void }) {
  persist = options.persist;
}
export function hydratePro(stored: Record<string, unknown>) {
  usePro.setState({ owned: stored[CACHE_KEY] === true });
  fallBack(stored[CACHE_KEY] === true);
}

/** Refunded or never bought: a Pro theme chosen earlier falls back to the base theme. */
function fallBack(owned: boolean) {
  const { theme, set } = useSettings.getState();
  if (!canUseTheme(theme, owned)) set('theme', BASE_THEME as typeof theme);
}

function setOwned(owned: boolean) {
  if (usePro.getState().owned !== owned) persist(CACHE_KEY, owned);
  usePro.setState({ owned, checked: true });
  fallBack(owned);
}

/** Asks StoreKit; keeps the cached answer when the store can't be reached. */
export async function refreshPro() {
  const owned = await purchases.owns(PRO_PRODUCT_ID);
  if (owned !== null) setOwned(owned);
  return owned;
}

export async function loadProProduct() {
  if (usePro.getState().product || usePro.getState().loadingProduct) return;
  usePro.setState({ loadingProduct: true });
  const product = await purchases.product(PRO_PRODUCT_ID);
  usePro.setState({ product, loadingProduct: false });
}

export async function buyPro(): Promise<BuyResult> {
  const result = await purchases.buy(PRO_PRODUCT_ID);
  if (result === 'purchased') setOwned(true);
  // Only the outcome is logged, nothing about the transaction.
  log('info', 'pro purchase', { result });
  return result;
}

export async function restorePro(): Promise<boolean | null> {
  const owned = await purchases.restore(PRO_PRODUCT_ID);
  if (owned !== null) setOwned(owned);
  log('info', 'pro restore', { found: owned });
  return owned;
}

/** Starts listening for transactions and checks ownership. Returns a stop function. */
export async function startPro() {
  if (!purchases.supported) return () => {};
  const stop = await purchases.start(() => void refreshPro());
  await refreshPro();
  return stop;
}

/** Whether Pro is owned, for screens. */
export const useProOwned = () => usePro((s) => s.owned);

/** Opens the Pro screen (from any lock). */
export const PRO_ROUTE = '/pro' as const;
