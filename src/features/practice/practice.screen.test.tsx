import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { hitOf, miss } from '@/domain/darts';
import { latestFinished } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import Play from '../../app/(tabs)/index';
import Practice from '../../app/(tabs)/practice';
import DrillScreen from '../../app/drill/[sessionId]';
import { loadGame, recordDart, startDrill } from '../game/session';
import { useGame } from '../game/store';

import { personalBest } from './bests';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
const router = jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock } }>(
  'expo-router',
).router;

const YOU = { id: 'you', name: 'You' };

/** Plays a whole Bob's 27 with one hit per double. */
function playBobs(hitEvery = true): string {
  const id = startDrill('bobs27', {}, YOU);
  let game = loadGame(id);
  for (let n = 1; n <= 21 && game.def.currentPlayer(game.state); n++) {
    const seg = n === 21 ? 25 : n;
    for (let d = 0; d < 3 && game.def.currentPlayer(game.state); d++) {
      const hit = hitEvery && d === 0 ? hitOf(seg, 2) : miss();
      game = recordDart(game, { hit, point: null, source: 'keypad' });
    }
  }
  return id;
}

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  router.replace.mockClear();
  useGame.getState().close();
});

describe('Practice tab', () => {
  it('lists the base drills with no bests yet, Pro drills locked, and a suggestion', async () => {
    await render(<Practice />);
    await act(async () => {});
    expect(screen.getByText('Suggested for you')).toBeOnTheScreen();
    expect(screen.getAllByText("Bob's 27").length).toBeGreaterThan(0);
    expect(screen.getAllByText('No score yet')).toHaveLength(3);
    expect(screen.getByLabelText('Catch 40, part of Ton Up Pro')).toBeOnTheScreen();
  });

  it('shows your best after a drill', async () => {
    playBobs();
    await render(<Practice />);
    await act(async () => {});
    expect(screen.getByText('Best 497')).toBeOnTheScreen();
  });

  it('starts a drill', async () => {
    await render(<Practice />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('drill-countUp'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/drill/[sessionId]' }),
    );
  });
});

describe("Bob's 27 on the drill screen", () => {
  it('scores Hit and Miss, then shows the result against your best', async () => {
    playBobs(); // best 497
    const id = startDrill('bobs27', {}, YOU);
    mockParams = { sessionId: id };
    await render(<DrillScreen />);
    await act(async () => {});
    expect(screen.getByText('Round 1 of 21')).toBeOnTheScreen();
    expect(screen.getByText('470 to beat your best')).toBeOnTheScreen();
    // D1: hit, miss, miss → 29.
    await fireEvent.press(screen.getByTestId('drill-hit'));
    await fireEvent.press(screen.getByTestId('drill-miss'));
    await fireEvent.press(screen.getByTestId('drill-miss'));
    expect(screen.getByLabelText('Score 29')).toBeOnTheScreen();
    expect(screen.getByText('Round 2 of 21')).toBeOnTheScreen();
    // Blank every round until it drops out: 29 −4 −6 −8 −10 → 1, −12 → out at D6.
    for (let i = 0; i < 15; i++) await fireEvent.press(screen.getByTestId('drill-miss'));
    expect(screen.getByText('Out at D6')).toBeOnTheScreen();
    expect(screen.getByText('508 short of your best (497)')).toBeOnTheScreen();
    expect(latestFinished('drill')).toBe(id);
    expect(personalBest('bobs27')?.score).toBe(497);
  });

  it('calls a new best', async () => {
    playBobs(false); // a poor first go
    const id = playBobs();
    mockParams = { sessionId: id };
    await render(<DrillScreen />);
    await act(async () => {});
    expect(screen.getByText('New personal best!')).toBeOnTheScreen();
  });
});

describe('Last practice on Play', () => {
  it('shows the last drill with its score and the gap to your best', async () => {
    playBobs();
    playBobs(false);
    await render(<Play />);
    await act(async () => {});
    expect(screen.getByText("Bob's 27 · -3")).toBeOnTheScreen();
    expect(
      screen.getByText('500 short of your best (497) · D5 missed with all three darts'),
    ).toBeOnTheScreen();
  });
});
