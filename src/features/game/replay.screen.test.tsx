import { fireEvent, render, screen } from '@testing-library/react-native';

import { botThrow, seeded } from '@/domain/bot';
import type { PlayerRef } from '@/domain/darts';
import { fold, games } from '@/domain/games';
import { X01_DEFAULTS, x01Legs } from '@/domain/games/x01';

import { resetTestDb } from '../../../test/sqlite';
import Replay from '../../app/replay/[sessionId]';

import { loadGame, recordDart, startX01, x01State } from './session';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

const YOU: PlayerRef = { id: 'you', name: 'You' };
const BOT: PlayerRef = { id: 'bot-4', name: 'DartBot 4', botLevel: 4 };

/** Plays a best-of-3 between "you" (simulated) and the bot into the database. */
function playMatch(): string {
  const id = startX01({ ...X01_DEFAULTS, legs: 2 }, [YOU, BOT]);
  let game = loadGame(id);
  const rng = seeded(21);
  while (games.x01.currentPlayer(x01State(game))) {
    const up = games.x01.currentPlayer(x01State(game))!;
    const t = botThrow(games.x01, x01State(game), up.botLevel ?? 5, rng)!;
    // "You" use the keypad (no position), the bot lands at a point.
    game = recordDart(
      game,
      up.botLevel
        ? { hit: t.hit, point: t.point, source: 'bot' }
        : { hit: t.hit, point: null, source: 'keypad' },
    );
  }
  return id;
}

beforeEach(async () => {
  await resetTestDb();
});

describe('Replay', () => {
  it('opens on the last visit of the last leg: the checkout', async () => {
    const id = playMatch();
    mockParams = { sessionId: id };
    await render(<Replay />);
    const legs = x01Legs(x01State(loadGame(id)));
    expect(screen.getByText(`Replay · Leg ${legs.length}`)).toBeOnTheScreen();
    const last = legs[legs.length - 1]!.frames.at(-1)!;
    expect(screen.getByText(`Checkout ${last.scored}`)).toBeOnTheScreen();
  });

  it('shows the scores as they were at each visit, matching the game rebuilt to that point', async () => {
    const id = playMatch();
    const game = loadGame(id);
    mockParams = { sessionId: id, leg: '0' };
    await render(<Replay />);
    const frames = x01Legs(x01State(game))[0]!.frames;
    // Step back to the third visit of leg 1.
    for (let i = frames.length - 1; i > 2; i--)
      await fireEvent.press(screen.getByTestId('replay-prev'));
    const thrown = frames.slice(0, 3).reduce((n, f) => n + f.darts.length, 0);
    const then = fold(
      games.x01,
      x01State(game).settings,
      x01State(game).players,
      game.darts,
      thrown,
    );
    expect(screen.getByLabelText(`You, ${then.remaining[0]} left`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`DartBot 4, ${then.remaining[1]} left`)).toBeOnTheScreen();
  });

  it('switches legs and filters by player', async () => {
    const id = playMatch();
    mockParams = { sessionId: id };
    await render(<Replay />);
    await fireEvent.press(screen.getByText('Leg 1'));
    expect(screen.getByText('Replay · Leg 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('replay-filter'));
    expect(screen.getByText('Only You')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('replay-filter'));
    expect(screen.getByText('Only DartBot 4')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('replay-filter'));
    expect(screen.getByText('All players')).toBeOnTheScreen();
  });

  it('says so when nothing has been thrown', async () => {
    const id = startX01(X01_DEFAULTS, [YOU]);
    mockParams = { sessionId: id };
    await render(<Replay />);
    expect(screen.getByText('No darts thrown yet.')).toBeOnTheScreen();
  });
});
