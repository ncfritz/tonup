import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { ASSESS_DOUBLES, ASSESS_FINISHES, POOLS } from '@/domain/drills';
import { hitOf, miss, type Hit } from '@/domain/darts';
import { getSession } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import Practice from '../../app/(tabs)/practice';
import DrillScreen from '../../app/drill/[sessionId]';
import Trainer from '../../app/trainer';
import { loadGame, recordDart, startDrill } from '../game/session';
import { useGame } from '../game/store';
import { usePro } from '../pro/pro';

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

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  router.replace.mockClear();
  useGame.getState().close();
  usePro.setState({ owned: true });
});

/** An assessment with good scoring and checkouts but poor doubles, aimed as the screen aims. */
function assess() {
  const id = startDrill('assessment', {}, YOU);
  let game = loadGame(id);
  const throwAt = (hit: Hit) => {
    const intended = game.def.targetFor(game.state) ?? undefined;
    game = recordDart(game, { hit, point: null, source: 'keypad', intended });
  };
  for (let v = 0; v < 10; v++) for (let d = 0; d < 3; d++) throwAt(hitOf(20, 3));
  // Doubles: D16 missed every time, one hit on D20 only.
  for (const n of ASSESS_DOUBLES) {
    for (let d = 0; d < 3; d++) throwAt(n === 20 && d === 0 ? hitOf(20, 2) : miss());
  }
  // Checkouts: finish four of the six with the route's darts.
  for (const [i, n] of ASSESS_FINISHES.entries()) {
    if (i >= 4) {
      for (let d = 0; d < 3; d++) throwAt(miss());
      continue;
    }
    let left = n;
    while (left > 0 && game.def.currentPlayer(game.state)) {
      const t = game.def.targetFor(game.state)!;
      const hit = hitOf(t.segment, t.multiplier);
      left -= hit.score;
      throwAt(hit);
    }
  }
  expect(game.def.result(game.state)).not.toBeNull();
  return id;
}

describe('Pro practice', () => {
  it('asks for the assessment first, then plans from the weakest area', async () => {
    const view = await render(<Practice />);
    await act(async () => {});
    expect(screen.getByText('Take the skill assessment')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('plan-assessment'));
    const sessionId = router.push.mock.calls[0][0].params.sessionId;
    expect(getSession(sessionId)?.typeId).toBe('assessment');
    await view.unmount();

    assess();
    // A Checkouts Practice with every dart missed: three more at each double.
    const cp = startDrill('checkouts', {}, YOU);
    let g = loadGame(cp);
    while (g.def.currentPlayer(g.state)) {
      const intended = g.def.targetFor(g.state) ?? undefined;
      g = recordDart(g, { hit: miss(), point: null, source: 'keypad', intended });
    }
    await render(<Practice />);
    await act(async () => {});
    expect(screen.getByText('Doubles is your weakest area (level 1 of 5).')).toBeOnTheScreen();
    expect(screen.getByText(/D18 at 0%/)).toBeOnTheScreen();
    // Two doubles drills; the Checkouts Practice just played shows as done today.
    const planned = POOLS.doubles.filter((id) => screen.queryByTestId(`plan-${id}`));
    const done = screen.queryAllByLabelText('Done today').length;
    expect(planned.length + done).toBe(2);
  });

  it('starts a Pro drill, and Random Checkout deals its finishes', async () => {
    await render(<Practice />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('drill-randomCheckout'));
    const sessionId = router.push.mock.calls[0][0].params.sessionId;
    const settings = getSession(sessionId)!.settings as { targets: number[] };
    expect(settings.targets).toHaveLength(20);
  });

  it('shows the finish and route on the drill screen', async () => {
    const id = startDrill('catch40', {}, YOU);
    mockParams = { sessionId: id };
    await render(<DrillScreen />);
    await act(async () => {});
    expect(screen.getByText('Finish 61 · 6 darts left')).toBeOnTheScreen();
    expect(screen.getByText('Route T15 · D8')).toBeOnTheScreen();
  });

  it('runs the checkout trainer and sends the deck to the board', async () => {
    await render(<Trainer />);
    for (let i = 0; i < 10; i++) {
      await fireEvent.press(screen.getByTestId('trainer-show'));
      expect(screen.getByTestId('trainer-route')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId(i === 0 ? 'trainer-missed' : 'trainer-knew'));
    }
    // The card you didn't know comes back once.
    await fireEvent.press(screen.getByTestId('trainer-show'));
    await fireEvent.press(screen.getByTestId('trainer-knew'));
    expect(screen.getByText('9 of 10 first time')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('trainer-board'));
    const sessionId = router.replace.mock.calls[0][0].params.sessionId;
    const s = getSession(sessionId)!;
    expect(s.typeId).toBe('randomCheckout');
    expect((s.settings as { targets: number[] }).targets).toHaveLength(10);
  });
});
