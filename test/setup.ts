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
