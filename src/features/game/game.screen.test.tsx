import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';

import { X01_DEFAULTS } from '@/domain/games/x01';
import { getSession, latestUnfinished, loadDarts } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import GameScreen from '../../app/game/[sessionId]';

import { botId, YOU_ID } from './lineup';
import { startX01 } from './session';
import { useGame } from './store';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
const mockRouter = jest.requireMock<{ router: { replace: jest.Mock; navigate: jest.Mock } }>(
  'expo-router',
).router;

const YOU = { id: YOU_ID, name: 'You' };
const BOT = { id: botId(5), name: 'DartBot 5', botLevel: 5 };

beforeEach(async () => {
  await resetTestDb();
  jest.clearAllMocks();
  useGame.getState().close();
});

async function open(id: string) {
  mockParams = { sessionId: id };
  await render(<GameScreen />);
  await act(async () => {});
}

const keypad = async (...keys: string[]) => {
  await fireEvent.press(screen.getByText('Keypad'));
  for (const k of keys) {
    const ring = k.startsWith('T') ? 'Treble' : k.startsWith('D') ? 'Double' : null;
    if (ring) await fireEvent.press(screen.getByText(ring));
    await fireEvent.press(screen.getByTestId(`key-${k}`));
  }
};

describe('the scoring screen', () => {
  it('scores a visit from the keypad, calls it, and saves every dart', async () => {
    const id = startX01({ ...X01_DEFAULTS, legs: 1 }, [YOU]);
    await open(id);
    expect(screen.getByLabelText(/You, 501 left/)).toBeOnTheScreen();
    await keypad('T20', 'T20', 'T20');
    expect(screen.getByLabelText(/You, 321 left/)).toBeOnTheScreen();
    expect(Speech.speak).toHaveBeenCalledWith('One hundred and eighty!', expect.anything());
    expect(loadDarts(id)).toHaveLength(3);
    expect(latestUnfinished()).toBe(id);
  });

  it('shows the checkout route, and Next records misses for the darts left', async () => {
    const id = startX01({ ...X01_DEFAULTS, startScore: 141, legs: 1 }, [YOU]);
    await open(id);
    expect(screen.getByText('T20 · T19 · D12')).toBeOnTheScreen();
    await keypad('20');
    await fireEvent.press(screen.getByTestId('next'));
    expect(loadDarts(id).map((d) => d.hit.score)).toEqual([20, 0, 0]);
    expect(screen.getByLabelText(/You, 121 left/)).toBeOnTheScreen();
  });

  it('undoes a dart', async () => {
    const id = startX01(X01_DEFAULTS, [YOU]);
    await open(id);
    await keypad('T20', 'T19');
    await fireEvent.press(screen.getByTestId('undo'));
    expect(screen.getByLabelText(/You, 441 left/)).toBeOnTheScreen();
    expect(loadDarts(id)).toHaveLength(1);
  });

  it('lets the bot throw its visit, then hands back to you', async () => {
    jest.useFakeTimers();
    try {
      const id = startX01(X01_DEFAULTS, [YOU, BOT]);
      await open(id);
      await keypad('1', '1', '1');
      expect(screen.getByText('DartBot 5 is throwing…')).toBeOnTheScreen();
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });
      }
      expect(loadDarts(id).filter((d) => d.source === 'bot')).toHaveLength(3);
      expect(screen.getByText(/^DartBot 5: /)).toBeOnTheScreen();
      // Undo takes back the bot's darts and your last one.
      await fireEvent.press(screen.getByTestId('undo'));
      expect(loadDarts(id)).toHaveLength(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('pauses on a leg win and goes to the summary when the match is won', async () => {
    const id = startX01({ ...X01_DEFAULTS, startScore: 40, legs: 2 }, [YOU]);
    await open(id);
    await keypad('D20');
    expect(screen.getByText('Leg 1 to You')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('next-leg'));
    await keypad('D20');
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/summary/[sessionId]',
      params: { sessionId: id },
    });
  });

  it('edits a dart from its slot', async () => {
    const id = startX01(X01_DEFAULTS, [YOU]);
    await open(id);
    await keypad('T20');
    await fireEvent.press(screen.getByTestId('slot-0'));
    expect(screen.getByText('Was T20')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByTestId('key-19')[1]!);
    expect(loadDarts(id)[0]).toMatchObject({ corrected: true, hit: { score: 19 } });
  });
});

describe('with VoiceOver', () => {
  it('opens on the keypad, with keys spoken in full', async () => {
    const { AccessibilityInfo } = jest.requireActual<typeof import('react-native')>('react-native');
    const spy = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const id = startX01(X01_DEFAULTS, [YOU]);
    await open(id);
    await fireEvent.press(screen.getByText('Treble'));
    expect(screen.getByLabelText('Treble 20')).toBeOnTheScreen();
    expect(screen.getByLabelText('Bullseye, 50')).toBeOnTheScreen();
    spy.mockRestore();
  });
});

describe('leaving before the end', () => {
  const alertSpy = () =>
    jest
      .spyOn(jest.requireActual<typeof import('react-native')>('react-native').Alert, 'alert')
      .mockImplementation(() => {});
  const press = (spy: jest.SpyInstance, text: string) =>
    act(async () => {
      (spy.mock.calls[0]![2] as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === text,
      )!.onPress!();
    });

  it('leaves no trace when nothing was thrown', async () => {
    const id = startX01(X01_DEFAULTS, [YOU]);
    await open(id);
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(getSession(id)).toBeNull();
    expect(mockRouter.navigate).toHaveBeenCalledWith('/');
  });

  it('asks, then discards the game and its darts, or keeps it for later', async () => {
    const spy = alertSpy();
    const kept = startX01(X01_DEFAULTS, [YOU]);
    await open(kept);
    await keypad('T20');
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(spy.mock.calls[0]![0]).toBe('Leave this game?');
    await press(spy, 'Keep for later');
    expect(getSession(kept)).not.toBeNull();
    expect(latestUnfinished()).toBe(kept);
    await screen.unmount();

    spy.mockClear();
    const id = startX01(X01_DEFAULTS, [YOU]);
    await open(id);
    await keypad('T20');
    await fireEvent.press(screen.getByTestId('header-back'));
    await press(spy, 'Discard');
    expect(getSession(id)).toBeNull();
    expect(loadDarts(id)).toEqual([]);
    expect(mockRouter.navigate).toHaveBeenLastCalledWith('/');
    spy.mockRestore();
  });
});
