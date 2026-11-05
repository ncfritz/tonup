import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { hitOf, miss } from '@/domain/darts';
import { getSession, latestFinished } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import Play from '../../app/(tabs)/index';
import Practice from '../../app/(tabs)/practice';
import DrillScreen from '../../app/drill/[sessionId]';
import DrillStats from '../../app/drill-stats/[drillId]';
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
const router = jest.requireMock<{
  router: { push: jest.Mock; replace: jest.Mock; navigate: jest.Mock };
}>('expo-router').router;

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

  it('opens a drill’s page from its row, and starts it from there', async () => {
    await render(<Practice />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('drill-countUp'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/drill-stats/[drillId]',
      params: { drillId: 'countUp' },
    });
    mockParams = { drillId: 'countUp' };
    await render(<DrillStats />);
    await fireEvent.press(screen.getByTestId('drill-play'));
    expect(router.replace).toHaveBeenCalledWith(
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

describe('Last practice on Practice', () => {
  it('shows the last drill with its score and the gap to your best', async () => {
    playBobs();
    playBobs(false);
    await render(<Practice />);
    await act(async () => {});
    expect(screen.getByText("Bob's 27 · -3")).toBeOnTheScreen();
    expect(
      screen.getByText('500 short of your best (497) · D5 missed with all three darts'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('practice-again'));
    expect(router.push).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: '/drill/[sessionId]' }),
    );
  });

  it('is gone from Play, which lists every game instead', async () => {
    playBobs();
    await render(<Play />);
    await act(async () => {});
    expect(screen.queryByTestId('last-practice')).toBeNull();
    await fireEvent.press(screen.getByTestId('pick-cricket'));
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/new-game',
      params: { game: 'cricket' },
    });
  });
});

describe('leaving a drill', () => {
  it('goes without a trace before any dart, and asks once darts are in', async () => {
    const empty = startDrill('bobs27', {}, YOU);
    mockParams = { sessionId: empty };
    const view = await render(<DrillScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(getSession(empty)).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith('/practice');
    await view.unmount();

    const { Alert } = jest.requireActual<typeof import('react-native')>('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const id = startDrill('bobs27', {}, YOU);
    mockParams = { sessionId: id };
    await render(<DrillScreen />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('drill-hit'));
    await fireEvent.press(screen.getByTestId('header-back'));
    expect(alert.mock.calls[0]![0]).toBe('Leave this drill?');
    await act(async () => {
      (alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[]).find(
        (b) => b.text === 'Discard',
      )!.onPress!();
    });
    expect(getSession(id)).toBeNull();
    alert.mockRestore();
  });
});
