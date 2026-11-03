// Jest setup: native modules that need mocks in unit and component tests.
import 'react-native-unistyles/mocks';
import 'react-native-gesture-handler/jestSetup';

import '../src/theme/unistyles';
import { initI18n } from '../src/i18n';

initI18n();

// Gesture Handler installs UI-runtime bindings via worklets, which aren't available under Jest.
jest.mock('react-native-worklets', () => ({
  ...jest.requireActual('react-native-worklets'),
  getUIRuntimeHolder: () => ({}),
}));

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

// UUIDs from Node's crypto in tests.
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));

// No native SQLite in tests. Tests that need a database mock this with test/sqlite.ts.
jest.mock('@/services/db/client', () => ({ db: {}, sqlite: {}, DATABASE_NAME: 'test.db' }));

// Native modules with nothing to do in tests.
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('expo-keep-awake', () => ({ useKeepAwake: () => {} }));

// StoreKit isn't available in tests: no products, nothing owned (src/services/purchases).
jest.mock('expo-iap', () => ({
  initConnection: async () => true,
  endConnection: async () => true,
  fetchProducts: async () => [],
  getAvailablePurchases: async () => [],
  requestPurchase: async () => null,
  finishTransaction: async () => undefined,
  restorePurchases: async () => undefined,
  purchaseUpdatedListener: () => ({ remove: () => {} }),
}));

// Reanimated can't start under Jest: the swipeable row renders its content with its actions
// already showing, so tests can press them.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { createElement, Fragment } = jest.requireActual<typeof import('react')>('react');
  const close = () => {};
  return {
    __esModule: true,
    default: ({
      children,
      renderRightActions,
    }: {
      children: unknown;
      renderRightActions?: (p: unknown, t: unknown, m: { close: () => void }) => unknown;
    }) =>
      createElement(
        Fragment,
        null,
        children as never,
        (renderRightActions?.({ value: 0 }, { value: 0 }, { close }) ?? null) as never,
      ),
  };
});

// Reanimated's own mock still starts its native side, so a small stand-in for what the app uses.
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: <T>(c: T) => c },
    useAnimatedReaction: () => {},
    useAnimatedStyle: () => ({}),
  };
});
