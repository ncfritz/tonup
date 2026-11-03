import type { BuyResult, PurchasesService, StoreProduct } from './types';

/** The parts of expo-iap this service uses (so it can be tested with a fake). */
export interface IapApi {
  initConnection(): Promise<boolean>;
  endConnection(): Promise<boolean>;
  fetchProducts(args: { skus: string[]; type: 'in-app' }): Promise<unknown>;
  getAvailablePurchases(args: {
    onlyIncludeActiveItemsIOS: boolean;
  }): Promise<{ productId: string }[]>;
  requestPurchase(args: { request: { apple: { sku: string } }; type: 'in-app' }): Promise<unknown>;
  finishTransaction(args: { purchase: never; isConsumable: boolean }): Promise<void>;
  restorePurchases(): Promise<void>;
  purchaseUpdatedListener(
    listener: (purchase: { productId: string; purchaseState?: string }) => void,
  ): {
    remove(): void;
  };
}

const errorCode = (e: unknown) =>
  e && typeof e === 'object' && 'code' in e ? String((e as { code: unknown }).code) : '';

/**
 * StoreKit 2 through expo-iap. Ownership is `Transaction.currentEntitlements` (verified on the
 * device by StoreKit; refunded or revoked purchases drop out). expo-iap's optional hosted
 * verification (IAPKit) is never called.
 */
export function storeKitPurchases(iap: IapApi): PurchasesService {
  let connected: Promise<boolean> | null = null;
  const connect = () => {
    connected ??= iap.initConnection().catch(() => {
      connected = null;
      return false;
    });
    return connected;
  };

  const owns = async (id: string) => {
    if (!(await connect())) return null;
    try {
      const owned = await iap.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      return owned.some((p) => p.productId === id);
    } catch {
      return null;
    }
  };

  return {
    supported: true,
    async start(onChange) {
      await connect();
      const sub = iap.purchaseUpdatedListener((purchase) => {
        // Finish so StoreKit stops redelivering it; ownership is read from entitlements.
        if (purchase.purchaseState !== 'pending') {
          void iap
            .finishTransaction({ purchase: purchase as never, isConsumable: false })
            .catch(() => {});
        }
        onChange();
      });
      return () => sub.remove();
    },
    async product(id) {
      if (!(await connect())) return null;
      try {
        const list = (await iap.fetchProducts({ skus: [id], type: 'in-app' })) as
          { id: string; displayPrice: string; isFamilyShareableIOS?: boolean }[] | null;
        const p = list?.find((x) => x.id === id);
        return p
          ? ({
              id: p.id,
              displayPrice: p.displayPrice,
              familyShareable: !!p.isFamilyShareableIOS,
            } satisfies StoreProduct)
          : null;
      } catch {
        return null;
      }
    },
    owns,
    async buy(id): Promise<BuyResult> {
      if (!(await connect())) return 'failed';
      try {
        const result = await iap.requestPurchase({
          request: { apple: { sku: id } },
          type: 'in-app',
        });
        const purchases = (Array.isArray(result) ? result : result ? [result] : []) as {
          productId: string;
          purchaseState?: string;
        }[];
        const mine = purchases.find((p) => p.productId === id);
        if (mine?.purchaseState === 'pending') return 'pending';
        if (mine)
          await iap
            .finishTransaction({ purchase: mine as never, isConsumable: false })
            .catch(() => {});
        return (await owns(id)) ? 'purchased' : mine ? 'pending' : 'failed';
      } catch (e) {
        if (errorCode(e) === 'user-cancelled') return 'cancelled';
        if (errorCode(e) === 'deferred-payment' || errorCode(e) === 'pending') return 'pending';
        return 'failed';
      }
    },
    async restore(id) {
      if (!(await connect())) return null;
      try {
        await iap.restorePurchases();
      } catch (e) {
        if (errorCode(e) === 'user-cancelled') return owns(id);
        return null;
      }
      return owns(id);
    },
  };
}
