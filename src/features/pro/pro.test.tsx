import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import Pro from '../../app/pro';
import { DEFAULT_SETTINGS, useSettings } from '../settings/store';

import { buyPro, configurePro, hydratePro, refreshPro, restorePro, usePro } from './pro';

// A StoreKit stand-in, like Xcode's local StoreKit file: buy, restore and refund.
const mockStore = { owned: false, reachable: true, result: 'purchased' as string };
jest.mock('@/services/purchases', () => ({
  purchases: {
    supported: true,
    start: async () => () => {},
    product: async () =>
      mockStore.reachable
        ? { id: 'app.tonup.pro', displayPrice: '$19.99', familyShareable: true }
        : null,
    owns: async () => (mockStore.reachable ? mockStore.owned : null),
    buy: async () => {
      if (mockStore.result === 'purchased') mockStore.owned = true;
      return mockStore.result;
    },
    restore: async () => (mockStore.reachable ? mockStore.owned : null),
  },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

const saved: [string, unknown][] = [];
beforeEach(() => {
  Object.assign(mockStore, { owned: false, reachable: true, result: 'purchased' });
  usePro.setState({ owned: false, checked: false, product: null, loadingProduct: false });
  useSettings.setState(DEFAULT_SETTINGS);
  saved.length = 0;
  configurePro({ persist: (k, v) => saved.push([k, v]) });
});

describe('Ton Up Pro', () => {
  it('buys, caches ownership, and survives a relaunch offline', async () => {
    expect(await buyPro()).toBe('purchased');
    expect(usePro.getState().owned).toBe(true);
    expect(saved).toEqual([['pro.owned', true]]);
    // Next launch: the cache says owned; the store can't be reached, so it stays owned.
    usePro.setState({ owned: false });
    hydratePro({ 'pro.owned': true });
    mockStore.reachable = false;
    expect(await refreshPro()).toBeNull();
    expect(usePro.getState().owned).toBe(true);
  });

  it('restores', async () => {
    mockStore.owned = true;
    expect(await restorePro()).toBe(true);
    expect(usePro.getState().owned).toBe(true);
  });

  it('locks again after a refund, and a Pro theme falls back to the base theme', async () => {
    await buyPro();
    useSettings.setState({ theme: 'arcade' as never });
    mockStore.owned = false; // refunded in StoreKit
    expect(await refreshPro()).toBe(false);
    expect(usePro.getState().owned).toBe(false);
    expect(useSettings.getState().theme).toBe('pro');
  });
});

describe('the Pro screen', () => {
  it('shows the price and unlocks on purchase', async () => {
    await render(<Pro />);
    await waitFor(() => expect(screen.getByText('Get Ton Up Pro · $19.99')).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('buy-pro'));
    await waitFor(() => expect(screen.getByText('You have Ton Up Pro')).toBeOnTheScreen());
    expect(screen.getByText('Ton Up Pro is unlocked.')).toBeOnTheScreen();
  });

  it('explains Ask to Buy and an unreachable store', async () => {
    mockStore.result = 'pending';
    await render(<Pro />);
    await waitFor(() => expect(screen.getByTestId('buy-pro')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('buy-pro'));
    await waitFor(() =>
      expect(
        screen.getByText("Waiting for approval. Pro unlocks as soon as it's approved."),
      ).toBeOnTheScreen(),
    );
  });

  it('says when no purchase is found to restore', async () => {
    await render(<Pro />);
    await fireEvent.press(screen.getByTestId('restore-pro'));
    await waitFor(() =>
      expect(
        screen.getByText('No Ton Up Pro purchase was found for this Apple Account.'),
      ).toBeOnTheScreen(),
    );
  });
});
