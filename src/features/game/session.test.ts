import { botThrow, seeded } from '@/domain/bot';
import { hitOf, label, miss, type PlayerRef } from '@/domain/darts';
import { games } from '@/domain/games';
import { X01_DEFAULTS } from '@/domain/games/x01';
import { getSession, latestUnfinished, loadDarts } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';

import {
  editDart,
  loadGame,
  previewEdit,
  recordDart,
  sessionX01Stats,
  startX01,
  undoLastDart,
  type LoadedGame,
  x01State,
} from './session';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());

const YOU: PlayerRef = { id: 'you', name: 'You' };
const BOT: PlayerRef = { id: 'bot', name: 'DartBot 3', botLevel: 3 };

const keypad = (hit = hitOf(20, 3)) => ({ hit, point: null, source: 'keypad' as const });

beforeEach(async () => {
  await resetTestDb();
});

describe('a stored X01 game', () => {
  it('folds from the database to exactly the live state, through a whole match', () => {
    const id = startX01({ ...X01_DEFAULTS, legs: 2 }, [YOU, BOT]);
    let game = loadGame(id);
    const rng = seeded(11);
    let guard = 0;
    while (games.x01.currentPlayer(x01State(game)) && guard++ < 2000) {
      const up = games.x01.currentPlayer(x01State(game))!;
      // Both players are bots here, so the test is a full, realistic match.
      const t = botThrow(games.x01, x01State(game), up.id === 'bot' ? 3 : 4, rng)!;
      game = recordDart(game, { hit: t.hit, point: t.point, source: 'bot', intended: t.intended });
    }
    expect(games.x01.result(x01State(game))).not.toBeNull();
    const reloaded = loadGame(id);
    expect(x01State(reloaded)).toEqual(x01State(game));
    expect(reloaded.darts).toEqual(game.darts);
    // The stored session is finished, so Home won't offer to resume it.
    expect(getSession(id)?.result).toEqual(games.x01.result(x01State(game)));
    expect(getSession(id)?.endedAt).toBe(game.darts[game.darts.length - 1]!.at);
    expect(latestUnfinished()).toBeNull();
  });

  it('offers the newest unfinished game to resume', () => {
    const first = startX01(X01_DEFAULTS, [YOU]);
    recordDart(loadGame(first), keypad());
    expect(latestUnfinished()).toBe(first);
    const resumed = loadGame(first);
    expect(x01State(resumed).remaining).toEqual([441]);
  });

  it('undoes darts, including the one that won, which reopens the game', () => {
    const id = startX01({ ...X01_DEFAULTS, startScore: 40, legs: 1 }, [YOU]);
    let game = recordDart(loadGame(id), keypad(hitOf(20, 2)));
    expect(getSession(id)?.endedAt).not.toBeNull();
    game = undoLastDart(game);
    expect(x01State(game).remaining).toEqual([40]);
    expect(getSession(id)).toMatchObject({ endedAt: null, result: null });
    expect(loadDarts(id)).toEqual([]);
    expect(undoLastDart(game)).toBe(game);
  });

  it('never stores a dart the rules reject', () => {
    const id = startX01({ ...X01_DEFAULTS, startScore: 40, legs: 1 }, [YOU]);
    const game = recordDart(loadGame(id), keypad(hitOf(20, 2)));
    expect(() => recordDart(game, keypad())).toThrow('over');
    expect(loadDarts(id)).toHaveLength(1);
  });

  it('edits a dart and drops later darts that no longer fit the turn order', () => {
    const id = startX01({ ...X01_DEFAULTS, startScore: 101 }, [YOU, BOT]);
    let game: LoadedGame = loadGame(id);
    // You: T20 20 1 (81 → 20 left). Bot: three misses. You: D10 would win...
    for (const h of [hitOf(20, 3), hitOf(20, 1), hitOf(1, 1), miss(), miss(), miss()]) {
      game = recordDart(game, keypad(h));
    }
    expect(x01State(game).remaining).toEqual([20, 101]);
    // A harmless edit keeps everything: your third dart was a 5, not a 1.
    const same = editDart(game, 2, { hit: hitOf(5, 1), point: null, source: 'keypad' });
    expect(same.dropped).toBe(0);
    expect(x01State(same.game).remaining).toEqual([16, 101]);
    game = same.game;
    // Change your second dart to T20: 120 > 101 is a bust on dart 2, so your third dart and
    // the bot's three darts now belong to the wrong turn.
    const change = { hit: hitOf(20, 3), point: null, source: 'keypad' as const };
    expect(previewEdit(game, 1, change)).toBe(4);
    const { game: after, dropped } = editDart(game, 1, change);
    expect(dropped).toBe(4);
    expect(x01State(after).remaining).toEqual([101, 101]);
    expect(label(after.darts[1]!.hit)).toBe('T20');
    expect(after.darts[1]!.corrected).toBe(true);
    expect(x01State(loadGame(id))).toEqual(x01State(after));
    expect(loadDarts(id)).toEqual(after.darts);
  });

  it('caches stats and recomputes them after a change', () => {
    const id = startX01(X01_DEFAULTS, [YOU]);
    let game = recordDart(loadGame(id), keypad());
    expect(sessionX01Stats(game, 'you').points).toBe(60);
    expect(sessionX01Stats(game, 'you').points).toBe(60);
    game = recordDart(game, keypad(hitOf(19, 3)));
    expect(sessionX01Stats(game, 'you').points).toBe(117);
  });
});
