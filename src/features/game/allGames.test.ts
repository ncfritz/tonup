import { botThrow, seeded } from '@/domain/bot';
import { gameFor, type GameId } from '@/domain/games';
import { drawNumbers } from '@/domain/games/killer';

import { resetTestDb } from '../../../test/sqlite';

import { loadGame, recordDart, sessionStats, startGame } from './session';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());

const BOTS = [
  { id: 'bot-2', name: 'DartBot 2', botLevel: 2 },
  { id: 'bot-4', name: 'DartBot 4', botLevel: 4 },
  { id: 'bot-5', name: 'DartBot 5', botLevel: 5 },
];

const settingsFor = (id: GameId, n: number) => {
  const defaults = gameFor(id).defaults as Record<string, unknown>;
  return id === 'killer' ? { ...defaults, numbers: drawNumbers(n, seeded(3)) } : defaults;
};

beforeEach(async () => {
  await resetTestDb();
});

// M5's done-when: every game plays end to end. Bots follow each game's own aim, so a finished
// game also shows the bot strategy works for it.
describe.each(['x01', 'cricket', 'clock', 'shanghai', 'killer'] as GameId[])('%s', (id) => {
  it('plays to a result with three bots, stored and reloaded identically', () => {
    const sessionId = startGame(id, settingsFor(id, 3), BOTS);
    let game = loadGame(sessionId);
    const rng = seeded(id.length * 7);
    let guard = 0;
    while (game.def.currentPlayer(game.state) && guard++ < 5000) {
      const up = game.def.currentPlayer(game.state)!;
      const t = botThrow(game.def, game.state, up.botLevel!, rng)!;
      game = recordDart(game, { hit: t.hit, point: t.point, source: 'bot', intended: t.intended });
    }
    expect(game.def.result(game.state)).not.toBeNull();
    const reloaded = loadGame(sessionId);
    expect(reloaded.state).toEqual(game.state);
    expect(reloaded.session.endedAt).not.toBeNull();
    for (const p of BOTS) expect(sessionStats(reloaded, p.id).length).toBeGreaterThan(0);
  });
});
