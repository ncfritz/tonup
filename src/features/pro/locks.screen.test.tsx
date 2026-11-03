import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { resetTestDb } from '../../../test/sqlite';
import Practice from '../../app/(tabs)/practice';
import Appearance from '../../app/(tabs)/settings/appearance';
import RulesPage from '../../app/rules/[gameId]';

import { usePro } from './pro';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn(), push: jest.fn(), navigate: jest.fn(), replace: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
const router = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router;

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  usePro.setState({ owned: false });
});

describe('locks open Ton Up Pro', () => {
  it('from a Pro drill', async () => {
    await render(<Practice />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('pro-drill-catch40'));
    expect(router.push).toHaveBeenCalledWith('/pro');
  });

  it('from a Pro theme', async () => {
    await render(<Appearance />);
    await fireEvent.press(screen.getByTestId('theme-arcade'));
    expect(router.push).toHaveBeenCalledWith('/pro');
  });

  it('from a Pro game’s rules page', async () => {
    mockParams = { gameId: 'golf' };
    await render(<RulesPage />);
    await fireEvent.press(screen.getByTestId('see-pro'));
    expect(router.push).toHaveBeenCalledWith('/pro');
  });

  it('with Pro owned, says what is still to come instead', async () => {
    usePro.setState({ owned: true });
    await render(<Practice />);
    await act(async () => {});
    expect(screen.getAllByText('Coming in an update').length).toBeGreaterThan(0);
  });
});
