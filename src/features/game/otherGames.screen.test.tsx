import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { CRICKET_DEFAULTS } from '@/domain/games/cricket';
import { KILLER_DEFAULTS } from '@/domain/games/killer';
import { SHANGHAI_DEFAULTS } from '@/domain/games/shanghai';
import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import GameScreen from '../../app/game/[sessionId]';
import NewGame from '../../app/new-game';
import { useSettings } from '../settings/store';

import { startGame } from './session';
import { useGame } from './store';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));
const router = jest.requireMock<{ router: { replace: jest.Mock } }>('expo-router').router;

const YOU = { id: 'you', name: 'You' };
const GUEST = { id: 'g', name: 'Sam' };

beforeEach(async () => {
  await resetTestDb();
  router.replace.mockClear();
  useGame.getState().close();
  useSettings.setState({ lastGameId: 'x01', gameSettings: {}, lastLineup: null });
});

async function open(id: string) {
  mockParams = { sessionId: id };
  await render(<GameScreen />);
  await act(async () => {});
  await fireEvent.press(screen.getByText('Keypad'));
}

const press = async (ring: 'Single' | 'Double' | 'Treble', n: number) => {
  await fireEvent.press(screen.getByText(ring));
  const name = ring === 'Treble' ? `T${n}` : ring === 'Double' ? `D${n}` : `${n}`;
  await fireEvent.press(screen.getByTestId(`key-${name}`));
};

describe('Cricket on the scoring screen', () => {
  it('shows marks in the grid and points', async () => {
    const id = startGame('cricket', { ...CRICKET_DEFAULTS, roundLimit: null }, [YOU, GUEST]);
    await open(id);
    expect(screen.getByText('Cricket')).toBeOnTheScreen();
    await press('Treble', 20);
    await press('Single', 20);
    expect(screen.getByLabelText('You, 20: closed')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sam, 20: no marks')).toBeOnTheScreen();
    expect(screen.getAllByText('20').length).toBeGreaterThan(0);
  });
});

describe('Shanghai on the scoring screen', () => {
  it('shows the round and what to aim for', async () => {
    const id = startGame('shanghai', SHANGHAI_DEFAULTS, [YOU]);
    await open(id);
    expect(screen.getByText('Shanghai · Round 1 of 7')).toBeOnTheScreen();
    expect(screen.getByText('This round')).toBeOnTheScreen();
    await press('Treble', 1);
    expect(screen.getByLabelText('You, 3 points')).toBeOnTheScreen();
  });
});

describe('Killer on the scoring screen', () => {
  it('shows numbers and lives, and becoming a Killer', async () => {
    const id = startGame('killer', { ...KILLER_DEFAULTS, numbers: [7, 11] }, [YOU, GUEST]);
    await open(id);
    expect(screen.getByText('Hit your double to become a Killer')).toBeOnTheScreen();
    await press('Double', 7);
    expect(screen.getByLabelText('You, number 7, 3 lives, Killer')).toBeOnTheScreen();
  });
});

describe('New game for other games', () => {
  it('starts Cut-Throat Cricket', async () => {
    mockParams = {};
    await render(<NewGame />);
    await fireEvent.press(screen.getByText('Cricket'));
    await fireEvent.press(screen.getByText('Cut-Throat'));
    await fireEvent.press(screen.getByTestId('start-game'));
    const sessionId = router.replace.mock.calls[0][0].params.sessionId;
    expect(getSession(sessionId)).toMatchObject({
      typeId: 'cricket',
      settings: { variant: 'cutThroat', roundLimit: 20 },
    });
    expect(useSettings.getState().lastGameId).toBe('cricket');
  });

  it('opens on the game a shortcut asked for, and draws Killer numbers at the start', async () => {
    mockParams = { game: 'killer' };
    await render(<NewGame />);
    expect(screen.getByText('Everyone gets a number when the game starts.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('start-game'));
    const sessionId = router.replace.mock.calls[0][0].params.sessionId;
    const numbers = (getSession(sessionId)!.settings as { numbers: number[] }).numbers;
    expect(numbers).toHaveLength(2);
    expect(new Set(numbers).size).toBe(2);
  });
});
