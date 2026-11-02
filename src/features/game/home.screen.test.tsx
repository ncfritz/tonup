import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { hitOf } from '@/domain/darts';
import { X01_DEFAULTS } from '@/domain/games/x01';
import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import Play from '../../app/(tabs)/index';
import { useSettings } from '../settings/store';

import { loadGame, recordDart, startX01 } from './session';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
const router = jest.requireMock<{ router: { push: jest.Mock } }>('expo-router').router;

const YOU = { id: 'you', name: 'You' };
const BOT = { id: 'bot-2', name: 'DartBot 2', botLevel: 2 };

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  useSettings.setState({ lastX01: null, lastLineup: null });
});

const keypad = (h = hitOf(20, 2)) => ({ hit: h, point: null, source: 'keypad' as const });

describe('Play home', () => {
  it('starts your usual game from Quick start', async () => {
    await render(<Play />);
    expect(screen.getByText('501 vs DartBot 3')).toBeOnTheScreen();
    expect(screen.getByText('Best of 5 legs · Double out')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('quick-start'));
    const id = router.push.mock.calls[0][0].params.sessionId;
    expect(getSession(id)?.players.map((p) => p.id)).toEqual(['you', 'bot-3']);
  });

  it('shows empty cards before any games, then the last match with its result', async () => {
    const view = await render(<Play />);
    expect(
      screen.getByText('Your last match will show here, with a replay of every dart.'),
    ).toBeOnTheScreen();
    // You win a one-leg 40 with D20.
    const id = startX01({ ...X01_DEFAULTS, startScore: 40, legs: 1 }, [YOU, BOT]);
    recordDart(loadGame(id), keypad());
    await view.unmount();
    await render(<Play />);
    await act(async () => {});
    expect(screen.getByText('Won 1–0 vs DartBot 2')).toBeOnTheScreen();
    expect(screen.getByText('40 · avg 120.0 · checkout 1 of 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Replay'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/replay/[sessionId]',
      params: { sessionId: id },
    });
  });

  it('offers to resume a game in progress', async () => {
    const id = startX01(X01_DEFAULTS, [YOU, BOT]);
    recordDart(loadGame(id), keypad(hitOf(20, 3)));
    await render(<Play />);
    await act(async () => {});
    expect(screen.getByText('501 · You 441 · DartBot 2 501')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('resume-game'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/game/[sessionId]',
      params: { sessionId: id },
    });
  });
});
