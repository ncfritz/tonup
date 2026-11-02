import { fireEvent, render, screen } from '@testing-library/react-native';

import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import NewGame from '../../app/new-game';
import { useSettings } from '../settings/store';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
}));
const router = jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router').router;

beforeEach(async () => {
  await resetTestDb();
  router.replace.mockClear();
  useSettings.setState({ lastX01: null, lastLineup: null });
});

describe('New game', () => {
  it('starts 501, best of 5, you against DartBot 3 by default', async () => {
    await render(<NewGame />);
    expect(screen.getByText('DartBot 3')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('5'));
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
    expect(useSettings.getState().lastX01).toMatchObject({ legs: 3 });
  });

  it('changes the bot level and adds a guest, up to six players', async () => {
    await render(<NewGame />);
    await fireEvent.press(screen.getByLabelText('Harder'));
    expect(screen.getByText('DartBot 4')).toBeOnTheScreen();
    expect(screen.getByText('Level 4 · averages about 75')).toBeOnTheScreen();
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByText('Add player'));
    expect(screen.getByText('Up to 6 players')).toBeOnTheScreen();
    expect(screen.queryByText('Add player')).toBeNull();
  });
});
