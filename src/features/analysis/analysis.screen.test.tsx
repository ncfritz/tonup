import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { parseGhost } from '@/domain/analysis';
import { centreOf, hitAt } from '@/domain/board';
import { gaussianPair, seeded } from '@/domain/bot';
import type { Target } from '@/domain/darts';
import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import AnalysisScreen from '../../app/analysis';
import History from '../../app/(tabs)/history';
import { loadGame, recordDart, startDrill } from '../game/session';
import { throwFor } from '../game/throwFor';
import { usePro } from '../pro/pro';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => ({}),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
const router = jest.requireMock<{ router: { push: jest.Mock; replace: jest.Mock } }>(
  'expo-router',
).router;

const YOU = { id: 'you', name: 'You' };

/** 100 darts at T20 tapped on the board, landing 6 mm low and left with σ 8 mm. */
function tapT20s() {
  const id = startDrill('t20', { darts: 100 }, YOU);
  let game = loadGame(id);
  const rng = seeded(3);
  const T20: Target = { segment: 20, multiplier: 3 };
  const c = centreOf(T20);
  while (game.def.currentPlayer(game.state)) {
    const [a, b] = gaussianPair(rng);
    const point = { x: c.x - 6 + a * 8, y: c.y - 6 + b * 8 };
    game = recordDart(game, { hit: hitAt(point), point, source: 'tap', intended: T20 });
  }
}

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  router.replace.mockClear();
  usePro.setState({ owned: true });
});

describe('Analysis', () => {
  it('opens from History, and is locked without Pro', async () => {
    usePro.setState({ owned: false });
    const view = await render(<History />);
    await fireEvent.press(screen.getByTestId('open-analysis'));
    expect(router.push).toHaveBeenCalledWith('/pro');
    await view.unmount();
    usePro.setState({ owned: true });
    await render(<History />);
    await fireEvent.press(screen.getByTestId('open-analysis'));
    expect(router.push).toHaveBeenLastCalledWith('/analysis');
  });

  it('says to tap darts when there are none', async () => {
    await render(<AnalysisScreen />);
    expect(screen.getByTestId('grouping-empty')).toBeOnTheScreen();
  });

  it('shows drift and grouping, where to aim, and plays your ghost', async () => {
    tapT20s();
    jest.useFakeTimers();
    await render(<AnalysisScreen />);
    expect(screen.getByTestId('drift')).toHaveTextContent(/Drift: \d+ mm low and left/);
    expect(screen.getByTestId('spread')).toHaveTextContent(/Grouping: σ [7-9]\.\d mm/);
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    jest.useRealTimers();
    expect(screen.getByTestId('aim-map')).toBeOnTheScreen();
    expect(screen.getByText(/From 100 darts at every target/)).toBeOnTheScreen();
    expect(screen.getByTestId('ghost-line')).toHaveTextContent(/Fitted from your tapped darts/);
    await fireEvent.press(screen.getByTestId('play-ghost'));
    const sessionId = router.replace.mock.calls[0][0].params.sessionId;
    const players = getSession(sessionId)!.players;
    const ghost = parseGhost(players[1]!.id)!;
    expect(ghost.dx).toBeLessThan(-3);
    expect(ghost.dy).toBeLessThan(-3);
    expect(players[1]!.botLevel).toBeDefined();
    // The ghost throws with its fit when it's up.
    const game = loadGame(sessionId);
    const t = throwFor(game.def, game.state, players[1]!, seeded(1));
    expect(t?.intended).toEqual({ segment: 20, multiplier: 3 });
  });
});
