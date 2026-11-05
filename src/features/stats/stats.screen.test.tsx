import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { botThrow, seeded } from '@/domain/bot';
import { drillFor, type DrillId } from '@/domain/drills';
import { hitOf, hitOfTarget, miss, type Hit, type PlayerRef, type Target } from '@/domain/darts';
import { gameFor, type GameId } from '@/domain/games';
import { CRICKET_DEFAULTS } from '@/domain/games/cricket';
import { X01_DEFAULTS } from '@/domain/games/x01';

import { resetTestDb } from '../../../test/sqlite';
import History from '../../app/(tabs)/history';
import DrillStats from '../../app/drill-stats/[drillId]';
import Replay from '../../app/replay/[sessionId]';
import Summary from '../../app/summary/[sessionId]';
import You from '../../app/you';
import { deal } from '../game/presets';
import { loadGame, recordDart, startDrill, startGame } from '../game/session';
import { usePro } from '../pro/pro';
import { DEFAULT_SETTINGS, useSettings } from '../settings/store';

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

/** Cards draw their chart once they know their width. */
const layout = { nativeEvent: { layout: { width: 358, height: 200 } } };

const YOU: PlayerRef = { id: 'you', name: 'You' };
const BOT: PlayerRef = { id: 'bot-2', name: 'DartBot 2', botLevel: 2 };
const SAM: PlayerRef = { id: 'sam', name: 'Sam' };

/** Plays a game between two lineups by simulated throws, you tapping the board. */
function playGame(typeId: GameId, settings: unknown, players: PlayerRef[]) {
  const id = startGame(typeId, deal(typeId, settings as Record<string, unknown>, players), players);
  let game = loadGame(id);
  const def = gameFor(typeId);
  const rng = seeded(7);
  let n = 0;
  while (def.currentPlayer(game.state) && n++ < 2000) {
    const up = def.currentPlayer(game.state)!;
    const t = botThrow(def, game.state, up.botLevel ?? 5, rng)!;
    game = recordDart(game, {
      hit: t.hit,
      point: t.point,
      source: up.botLevel ? 'bot' : 'tap',
      intended: t.intended,
    });
  }
  return id;
}

function playBobs() {
  const id = startDrill('bobs27', {}, YOU);
  let game = loadGame(id);
  for (let n = 1; n <= 21 && game.def.currentPlayer(game.state); n++) {
    const seg = n === 21 ? 25 : n;
    for (let d = 0; d < 3 && game.def.currentPlayer(game.state); d++) {
      const hit = d === 0 ? hitOf(seg, 2) : miss();
      game = recordDart(game, {
        hit,
        point: null,
        source: 'keypad',
        intended: { segment: seg, multiplier: 2 },
      });
    }
  }
  return id;
}

/** Plays a drill to the end, each dart from `hit` and aimed where the drill says. */
function playDrill(id: DrillId, hit: (i: number, aim: Target | null) => Hit) {
  const sessionId = startDrill(id, drillFor(id).defaults, YOU);
  let game = loadGame(sessionId);
  for (let i = 0; i < 1000 && game.def.currentPlayer(game.state); i++) {
    const aim = game.def.targetFor(game.state);
    game = recordDart(game, {
      hit: hit(i, aim),
      point: null,
      source: 'keypad',
      intended: aim ?? undefined,
    });
  }
  return sessionId;
}

/** Lays out every chart card on screen, so each draws its chart. */
async function drawAll() {
  for (const card of screen.queryAllByTestId(/^chart-/)) await fireEvent(card, 'layout', layout);
}

beforeEach(async () => {
  await resetTestDb();
  router.push.mockClear();
  router.replace.mockClear();
  usePro.setState({ owned: false });
  useSettings.setState(DEFAULT_SETTINGS);
});

describe('match summary charts', () => {
  it('draws the worm, visits and legs for X01, with your doubles behind Pro', async () => {
    const id = playGame('x01', { ...X01_DEFAULTS, startScore: 301, legs: 2 }, [YOU, BOT]);
    mockParams = { sessionId: id };
    await render(<Summary />);
    await act(async () => {});
    expect(screen.getByTestId('chart-worm')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-visits')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-legs')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Your doubles is part of Ton Up Pro/)).toBeOnTheScreen();
  });

  it('shows the double ladder with Pro', async () => {
    usePro.setState({ owned: true });
    const id = playGame('x01', { ...X01_DEFAULTS, startScore: 301, legs: 1 }, [YOU, BOT]);
    mockParams = { sessionId: id };
    await render(<Summary />);
    await act(async () => {});
    expect(screen.queryByLabelText(/part of Ton Up Pro/)).toBeNull();
    expect(screen.getByText(/at a double\./)).toBeOnTheScreen();
  });

  it('draws the closing grid and marks per round for Cricket', async () => {
    const id = playGame('cricket', { ...CRICKET_DEFAULTS, roundLimit: 20 }, [YOU, SAM]);
    mockParams = { sessionId: id };
    await render(<Summary />);
    await act(async () => {});
    expect(screen.getByTestId('chart-closing')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-rounds')).toBeOnTheScreen();
    expect(screen.getByText(/You closed \d of 7 first\./)).toBeOnTheScreen();
  });

  it('draws the number wheel for Around the Clock', async () => {
    const id = playGame('clock', gameFor('clock').defaults, [YOU]);
    mockParams = { sessionId: id };
    await render(<Summary />);
    await act(async () => {});
    expect(screen.getByTestId('chart-wheel')).toBeOnTheScreen();
    expect(screen.getByText(/Slowest for you:/)).toBeOnTheScreen();
  });

  it('follows the scrubber with the worm in Replay', async () => {
    const id = playGame('x01', { ...X01_DEFAULTS, startScore: 301, legs: 1 }, [YOU, BOT]);
    mockParams = { sessionId: id };
    await render(<Replay />);
    await act(async () => {});
    expect(screen.getByTestId('replay-worm')).toBeOnTheScreen();
  });
});

describe('drill page', () => {
  it('shows sessions, best and the calendar, with the session grid behind Pro', async () => {
    playBobs();
    playBobs();
    mockParams = { drillId: 'bobs27' };
    await render(<DrillStats />);
    await act(async () => {});
    expect(screen.getByLabelText('Sessions: 2')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-trend')).toBeOnTheScreen();
    expect(screen.getByTestId('chart-calendar')).toBeOnTheScreen();
    expect(screen.getByLabelText(/Steps · last 2 is part of Ton Up Pro/)).toBeOnTheScreen();
  });

  it('opens the grid and ladder with Pro', async () => {
    usePro.setState({ owned: true });
    playBobs();
    mockParams = { drillId: 'bobs27' };
    await render(<DrillStats />);
    await act(async () => {});
    await fireEvent(screen.getByTestId('chart-grid'), 'layout', layout);
    expect(screen.getByLabelText(/Each step of your last session/)).toBeOnTheScreen();
    expect(screen.getByTestId('chart-ladder')).toBeOnTheScreen();
  });

  it('remembers the range, and takes a custom one', async () => {
    playBobs();
    mockParams = { drillId: 'bobs27' };
    await render(<DrillStats />);
    await fireEvent.press(screen.getByTestId('range-60'));
    expect(useSettings.getState().statsRange).toEqual({ kind: 'days', days: 60 });
    await fireEvent.press(screen.getByTestId('range-custom'));
    await fireEvent.press(screen.getByTestId('range-all'));
    await fireEvent.press(screen.getByTestId('range-apply'));
    expect(useSettings.getState().statsRange.kind).toBe('custom');
    expect(screen.getByLabelText('Sessions: 1')).toBeOnTheScreen();
  });

  it('says so when the range has nothing in it', async () => {
    mockParams = { drillId: 'countUp' };
    await render(<DrillStats />);
    expect(screen.getByText(/No Count Up in this range/)).toBeOnTheScreen();
  });
});

describe('every chart draws', () => {
  beforeEach(() => usePro.setState({ owned: true }));

  it.each([
    ['x01', { ...X01_DEFAULTS, startScore: 301, legs: 2 }, [YOU, BOT]],
    ['cricket', { ...CRICKET_DEFAULTS, roundLimit: 20 }, [YOU, SAM]],
    ['clock', gameFor('clock').defaults, [YOU]],
    ['killer', gameFor('killer').defaults, [YOU, SAM, BOT]],
    ['football', gameFor('football').defaults, [YOU, SAM]],
    ['ticTacToe', gameFor('ticTacToe').defaults, [YOU, SAM]],
    ['scam', gameFor('scam').defaults, [YOU, SAM]],
  ] as const)('on a %s summary', async (typeId, settings, players) => {
    mockParams = { sessionId: playGame(typeId, settings, [...players]) };
    await render(<Summary />);
    await drawAll();
    expect(screen.getAllByTestId(/^chart-/).length).toBeGreaterThan(0);
  });

  it.each([
    ['bobs27', () => playBobs()],
    ['countUp', () => playDrill('countUp', () => hitOf(20, 3))],
    ['clock', () => playDrill('clock', (i, aim) => (i % 2 && aim ? hitOfTarget(aim) : miss()))],
    ['catch40', () => playDrill('catch40', () => miss())],
  ] as const)('on the %s page', async (drillId, play) => {
    play();
    play();
    mockParams = { drillId };
    await render(<DrillStats />);
    await drawAll();
    expect(screen.getByTestId('chart-trend')).toBeOnTheScreen();
  });

  it('on You', async () => {
    playGame('x01', { ...X01_DEFAULTS, startScore: 301, legs: 1 }, [YOU, BOT]);
    playBobs();
    await render(<You />);
    await drawAll();
    expect(screen.getByTestId('chart-you-doubles')).toBeOnTheScreen();
  });
});

describe('the four games’ own charts', () => {
  it.each([
    ['killer', 'chart-killer', [YOU, SAM, BOT]],
    ['football', 'chart-football', [YOU, SAM]],
    ['ticTacToe', 'chart-tictactoe', [YOU, SAM]],
    ['scam', 'chart-scam', [YOU, SAM]],
  ] as const)('%s', async (typeId, testID, players) => {
    mockParams = { sessionId: playGame(typeId, gameFor(typeId).defaults, [...players]) };
    await render(<Summary />);
    await fireEvent(screen.getByTestId(testID), 'layout', layout);
    expect(screen.getByTestId(testID)).toBeOnTheScreen();
  });
});

describe('History by game', () => {
  it('filters Matches to one game, with its trend and record', async () => {
    playGame('x01', { ...X01_DEFAULTS, startScore: 301, legs: 1 }, [YOU, BOT]);
    playGame('cricket', { ...CRICKET_DEFAULTS, roundLimit: 20 }, [YOU, SAM]);
    await render(<History />);
    await act(async () => {});
    await fireEvent.press(screen.getByRole('radio', { name: 'Matches' }));
    await fireEvent.press(screen.getByTestId('history-game-cricket'));
    expect(screen.getByText(/· last 1 game$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Played: 1$/)).toBeOnTheScreen();
    expect(screen.queryByText(/^301 · /)).toBeNull();
  });
});

describe('You', () => {
  it('pools games and drills: headline, head-to-head and records', async () => {
    playGame('x01', { ...X01_DEFAULTS, startScore: 301, legs: 1 }, [YOU, BOT]);
    playBobs();
    await render(<You />);
    await act(async () => {});
    for (const id of ['chart-opponents', 'chart-records'])
      await fireEvent(screen.getByTestId(id), 'layout', layout);
    expect(screen.getByText('Darts thrown')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^DartBot 2: won \d, lost \d$/)).toBeOnTheScreen();
    expect(screen.getByText("Bob's 27")).toBeOnTheScreen();
    expect(screen.getByLabelText(/Doubles is part of Ton Up Pro/)).toBeOnTheScreen();
  });

  it('is reached from History', async () => {
    await render(<History />);
    await act(async () => {});
    await fireEvent.press(screen.getByTestId('open-you'));
    expect(router.push).toHaveBeenCalledWith('/you');
  });
});
