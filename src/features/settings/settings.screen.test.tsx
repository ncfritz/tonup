import { fireEvent, render, screen } from '@testing-library/react-native';

import type { X01Settings } from '@/domain/games/x01';
import { X01_DEFAULTS } from '@/domain/games/x01';
import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import Appearance from '../../app/(tabs)/settings/appearance';
import Settings from '../../app/(tabs)/settings/index';
import NewGame from '../../app/new-game';
import { startX01 } from '../game/session';

import { DEFAULT_SETTINGS, setSettingsPersistence, useSettings } from './store';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-constants', () => ({
  expoConfig: { version: '0.1.0', ios: { buildNumber: '7' } },
}));
const router = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router;

const writes: [string, unknown][] = [];
beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  writes.length = 0;
  useSettings.setState(DEFAULT_SETTINGS);
  setSettingsPersistence((k, v) => writes.push([k, v]));
});

describe('Settings', () => {
  it('saves the caller, input and favourite double', async () => {
    await render(<Settings />);
    expect(screen.getByText('0.1.0 (7)')).toBeOnTheScreen();
    await fireEvent(screen.getByTestId('settings-caller'), 'valueChange', false);
    await fireEvent.press(screen.getByText('Keypad'));
    await fireEvent.press(screen.getByTestId('double-16'));
    expect(writes).toEqual([
      ['caller', false],
      ['defaultInput', 'keypad'],
      ['preferredDouble', 16],
    ]);
  });

  it('opens Appearance', async () => {
    await render(<Settings />);
    expect(screen.getByText('Pro · System')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('settings-appearance'));
    expect(router.push).toHaveBeenCalledWith('/settings/appearance');
  });
});

describe('Appearance', () => {
  it('changes the mode, and shows the Pro themes locked', async () => {
    await render(<Appearance />);
    await fireEvent.press(screen.getByText('Dark'));
    expect(useSettings.getState().appearance).toBe('dark');
    expect(screen.getByLabelText('Arcade, part of Ton Up Pro')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('theme-arcade'));
    expect(useSettings.getState().theme).toBe('pro');
  });
});

describe('the favourite double in play', () => {
  it('goes into new X01 games', () => {
    useSettings.setState({ preferredDouble: 16 });
    const id = startX01(X01_DEFAULTS, [{ id: 'you', name: 'You' }]);
    expect((getSession(id)!.settings as X01Settings).preferredDouble).toBe(16);
  });
});

describe('New game rules link', () => {
  it('opens the rules for the game picked', async () => {
    await render(<NewGame />);
    await fireEvent.press(screen.getByText('Shanghai'));
    await fireEvent.press(screen.getByTestId('game-rules'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/rules/[gameId]',
      params: { gameId: 'shanghai' },
    });
  });
});
