import { fireEvent, render, screen } from '@testing-library/react-native';

import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import NewGame from '../../app/new-game';
import { useSettings } from '../settings/store';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
const router = jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router').router;

beforeEach(async () => {
  await resetTestDb();
  router.replace.mockClear();
  useSettings.setState({ lastGameId: 'x01', gameSettings: {}, lastLineup: null });
});

describe('New game', () => {
  it('starts 501, best of 5, you against DartBot 3 by default', async () => {
    await render(<NewGame />);
    // Step 1: every game as a button, by family.
    expect(
      screen.getByText('Count down to exactly zero, finishing on a double.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('pick-x01'));
    // Step 2: set it up.
    expect(screen.getByTestId('setup-game')).toHaveTextContent('501 and 301');
    expect(screen.getByText('DartBot 3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('opt-legs-5'));
    await fireEvent.press(screen.getByTestId('start-game'));
    const id = router.replace.mock.calls[0][0].params.sessionId;
    expect(getSession(id)).toMatchObject({
      typeId: 'x01',
      settings: { startScore: 501, legs: 3, sets: 1, out: 'double', in: 'straight' },
      players: [
        { id: 'you', name: 'You' },
        { id: 'bot-3', name: 'DartBot 3', botLevel: 3 },
      ],
    });
    // Remembered for next time.
    expect(useSettings.getState().gameSettings.x01).toMatchObject({ legs: 3 });
  });

  it('changes the bot level, reorders, and adds guests up to six players', async () => {
    await render(<NewGame />);
    await fireEvent.press(screen.getByTestId('pick-x01'));
    await fireEvent.press(screen.getByTestId('player-1'));
    await fireEvent.press(screen.getByLabelText('Harder'));
    expect(screen.getAllByText('DartBot 4').length).toBeGreaterThan(0);
    expect(screen.getByText('Level 4 · averages about 75')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('player-earlier'));
    expect(screen.getByLabelText('DartBot 4, throws 1st')).toBeOnTheScreen();
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByTestId('add-player'));
    expect(screen.getByText('Up to 6 players')).toBeOnTheScreen();
    expect(screen.queryByTestId('add-player')).toBeNull();
  });

  it('searches the games and goes back to change the game', async () => {
    await render(<NewGame />);
    await fireEvent.changeText(screen.getByTestId('game-search'), 'shang');
    expect(screen.getByTestId('pick-shanghai')).toBeOnTheScreen();
    expect(screen.queryByTestId('pick-x01')).toBeNull();
    await fireEvent.press(screen.getByTestId('pick-shanghai'));
    expect(screen.getByTestId('opt-rounds-7')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('change-game'));
    expect(screen.getByTestId('game-search')).toBeOnTheScreen();
  });

  it('offers your last set-up to play again', async () => {
    await render(<NewGame />);
    await fireEvent.press(screen.getByTestId('pick-x01'));
    await fireEvent.press(screen.getByTestId('opt-legs-3'));
    await fireEvent.press(screen.getByTestId('start-game'));
    await screen.unmount();
    await render(<NewGame />);
    expect(
      screen.getByLabelText('Play 501 and 301 again: Best of 3 legs · vs DartBot 3'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('again-0'));
    expect(screen.getByTestId('opt-legs-3')).toBeSelected();
  });
});
