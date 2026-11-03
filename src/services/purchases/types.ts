/**
 * The one-time Ton Up Pro purchase (ADR 0009), as in Tippytoe: everything happens between the
 * phone and the App Store through StoreKit 2. Ownership comes from the device's verified current
 * entitlements; there's no receipt server and nothing about the purchase is sent to us (ADR 0001).
 */

export interface StoreProduct {
  id: string;
  /** Localized price from the App Store, e.g. "$19.99". */
  displayPrice: string;
  familyShareable: boolean;
}

/** `pending`: waiting for approval (Ask to Buy) or extra steps; it arrives later as an update. */
export type BuyResult = 'purchased' | 'pending' | 'cancelled' | 'failed';

export interface PurchasesService {
  /** Whether purchases work on this platform. */
  readonly supported: boolean;
  /**
   * Connects and listens for transactions that arrive outside a purchase in this session
   * (Ask to Buy approvals, offer codes, refunds, Family Sharing). Returns a stop function.
   */
  start(onChange: () => void): Promise<() => void>;
  product(id: string): Promise<StoreProduct | null>;
  /** Whether `id` is owned right now; null when the App Store couldn't be asked. */
  owns(id: string): Promise<boolean | null>;
  buy(id: string): Promise<BuyResult>;
  /** Syncs with the App Store (asks the user to sign in if needed), then checks again. */
  restore(id: string): Promise<boolean | null>;
}
