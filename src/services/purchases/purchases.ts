// Fallback for platforms without StoreKit.
import type { PurchasesService } from './types';

export const purchases: PurchasesService = {
  supported: false,
  start: async () => () => {},
  product: async () => null,
  owns: async () => null,
  buy: async () => 'failed',
  restore: async () => null,
};
