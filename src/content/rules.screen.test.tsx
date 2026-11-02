import { fireEvent, render, screen } from '@testing-library/react-native';

import { resetTestDb } from '../../test/sqlite';
import Rules from '../app/(tabs)/rules';
import Checkouts from '../app/rules/checkouts';
import RulesPage from '../app/rules/[gameId]';

jest.mock('@/services/db/client', () => jest.requireActual('../../test/sqlite').testClient());
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
const router = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router;

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
});

describe('Rules tab', () => {
  it('lists the games in the app and the Pro ones, and searches games and terms', async () => {
    await render(<Rules />);
    expect(screen.getByText('Games in the app')).toBeOnTheScreen();
    expect(screen.getByText('Cut-Throat Cricket')).toBeOnTheScreen();
    expect(screen.getByText('Golf')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('rules-search'), 'madhouse');
    expect(screen.getByText('Double 1, the lowest finish.')).toBeOnTheScreen();
    expect(screen.queryByText('Golf')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('rules-search'), 'qqq');
    expect(screen.getByText('Nothing matches “qqq”.')).toBeOnTheScreen();
  });
});

describe('a rules page', () => {
  it('shows the rules and starts the game with its variant', async () => {
    mockParams = { gameId: 'cutThroat' };
    await render(<RulesPage />);
    expect(screen.getByText('How to play')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('rules-play'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/new-game',
      params: { game: 'cricket', variant: 'cutThroat' },
    });
  });

  it('keeps Pro games readable but not playable', async () => {
    mockParams = { gameId: 'golf' };
    await render(<RulesPage />);
    expect(screen.getByText('Nine or eighteen holes, fewest strokes wins.')).toBeOnTheScreen();
    expect(screen.getByText('Part of Ton Up Pro')).toBeOnTheScreen();
    expect(screen.queryByTestId('rules-play')).toBeNull();
  });
});

describe('Checkouts', () => {
  it('lists finishes and filters by score', async () => {
    await render(<Checkouts />);
    expect(screen.getByLabelText('170: T20, T20, Bull')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('checkout-search'), '169');
    expect(screen.getByLabelText('169: No finish')).toBeOnTheScreen();
  });
});
