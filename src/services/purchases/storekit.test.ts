import { readFileSync } from 'fs';
import { join } from 'path';

import { storeKitPurchases, type IapApi } from './storekit';

const ID = 'app.tonup.pro';

function fakeIap(over: Partial<IapApi> = {}) {
  const owned: { productId: string }[] = [];
  const finished: unknown[] = [];
  const iap: IapApi = {
    initConnection: async () => true,
    endConnection: async () => true,
    fetchProducts: async () => [{ id: ID, displayPrice: '$19.99', isFamilyShareableIOS: true }],
    getAvailablePurchases: async () => owned,
    requestPurchase: async () => {
      owned.push({ productId: ID });
      return { productId: ID, purchaseState: 'purchased' };
    },
    finishTransaction: async (args) => {
      finished.push(args);
    },
    restorePurchases: async () => {},
    purchaseUpdatedListener: () => ({ remove: () => {} }),
    ...over,
  };
  return { iap, owned, finished };
}

describe('StoreKit purchases', () => {
  it('reads the price and buys, finishing the transaction', async () => {
    const { iap, finished } = fakeIap();
    const p = storeKitPurchases(iap);
    expect(await p.product(ID)).toEqual({ id: ID, displayPrice: '$19.99', familyShareable: true });
    expect(await p.owns(ID)).toBe(false);
    expect(await p.buy(ID)).toBe('purchased');
    expect(await p.owns(ID)).toBe(true);
    expect(finished).toHaveLength(1);
  });

  it('maps cancel, Ask to Buy and failures', async () => {
    const cancel = fakeIap({
      requestPurchase: async () => Promise.reject({ code: 'user-cancelled' }),
    });
    expect(await storeKitPurchases(cancel.iap).buy(ID)).toBe('cancelled');
    const deferred = fakeIap({
      requestPurchase: async () => Promise.reject({ code: 'deferred-payment' }),
    });
    expect(await storeKitPurchases(deferred.iap).buy(ID)).toBe('pending');
    const pending = fakeIap({
      requestPurchase: async () => ({ productId: ID, purchaseState: 'pending' }),
    });
    expect(await storeKitPurchases(pending.iap).buy(ID)).toBe('pending');
    const broken = fakeIap({ requestPurchase: async () => Promise.reject(new Error('boom')) });
    expect(await storeKitPurchases(broken.iap).buy(ID)).toBe('failed');
  });

  it('says "unknown" rather than "not owned" when the store is unreachable', async () => {
    const offline = fakeIap({ initConnection: async () => Promise.reject(new Error('offline')) });
    const p = storeKitPurchases(offline.iap);
    expect(await p.owns(ID)).toBeNull();
    expect(await p.product(ID)).toBeNull();
    const flaky = fakeIap({ getAvailablePurchases: async () => Promise.reject(new Error('x')) });
    expect(await storeKitPurchases(flaky.iap).owns(ID)).toBeNull();
  });

  it('restores, and a refund drops ownership', async () => {
    const { iap, owned } = fakeIap({
      restorePurchases: async () => void owned.push({ productId: ID }),
    });
    const p = storeKitPurchases(iap);
    expect(await p.restore(ID)).toBe(true);
    owned.length = 0; // StoreKit removes a refunded purchase from current entitlements
    expect(await p.owns(ID)).toBe(false);
  });

  it('never uses the hosted verification service', () => {
    // On-device only (ADR 0001): no IAPKit or verifyPurchaseWithProvider.
    const src = readFileSync(join(__dirname, 'storekit.ts'), 'utf8');
    expect(src).not.toMatch(/verifyPurchaseWithProvider\(|IapKit|iapkit\./);
  });
});
