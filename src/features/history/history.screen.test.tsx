import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { hitOf, miss } from '@/domain/darts';
import { X01_DEFAULTS } from '@/domain/games/x01';

import { resetTestDb } from '../../../test/sqlite';
import History from '../../app/(tabs)/history';
import { loadGame, recordDart, startDrill, startX01 } from '../game/session';

import { bests, destination, historyHeatmap, x01Trend } from './history';

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
const BOT = { id: 'bot-1', name: 'DartBot 1', botLevel: 1 };
const keypad = (hit = hitOf(20, 3)) => ({ hit, point: null, source: 'keypad' as const });

/** You check out 81 in two darts: T19, D12. */
function winX01(): string {
  const id = startX01({ ...X01_DEFAULTS, startScore: 81, legs: 1 }, [YOU, BOT]);
  let g = loadGame(id);
  for (const h of [hitOf(19, 3), hitOf(12, 2)]) g = recordDart(g, keypad(h));
  return id;
}

function countUp(points: number[]): string {
  const id = startDrill('countUp', { visits: 1 }, YOU);
  let g = loadGame(id);
  for (const p of points) g = recordDart(g, keypad(p ? hitOf(p, 1) : miss()));
  return id;
}

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
});

describe('history data', () => {
  it('trends your X01 average and finds your bests', () => {
    winX01();
    winX01();
    expect(x01Trend()).toEqual([121.5, 121.5]);
    const b = bests();
    expect(b.bestAverage?.value).toBeCloseTo(121.5);
    expect(b.highCheckout?.value).toBe(81);
  });

  it('heats the regions you hit', () => {
    winX01();
    const h = historyHeatmap('all');
    expect(h.total).toBe(2);
    expect(h.regions.map((r) => r.region).sort()).toEqual(['12:double', '19:treble']);
  });

  it('sends finished sessions to the replay and unfinished ones back into play', () => {
    const done = winX01();
    const open = startX01(X01_DEFAULTS, [YOU]);
    const drill = startDrill('bobs27', {}, YOU);
    expect(destination(done)?.pathname).toBe('/replay/[sessionId]');
    expect(destination(open)?.pathname).toBe('/game/[sessionId]');
    expect(destination(drill)?.pathname).toBe('/drill/[sessionId]');
  });
});

describe('History tab', () => {
  it('shows an empty state before anything is played', async () => {
    await render(<History />);
    await act(async () => {});
    expect(
      screen.getByText('Nothing played yet. Start a game from Play or a drill from Practice.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Play a few X01 matches to see your average here.')).toBeOnTheScreen();
  });

  it('lists matches and drills, filters them, and opens a replay', async () => {
    const match = winX01();
    countUp([20, 20, 5]);
    await render(<History />);
    await act(async () => {});
    expect(screen.getByText('81 · 1–0')).toBeOnTheScreen();
    expect(screen.getByText('Count Up · 45')).toBeOnTheScreen();
    expect(screen.getByLabelText('Best average: 121.5')).toBeOnTheScreen();
    expect(screen.getByLabelText('High checkout: 81')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Practice'));
    expect(screen.queryByText('81 · 1–0')).toBeNull();
    expect(screen.getByText('Count Up · last go')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Matches'));
    await fireEvent.press(screen.getByTestId(`history-${match}`));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/replay/[sessionId]',
      params: { sessionId: match },
    });
  });
});
