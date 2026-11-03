import { botThrow, seeded } from '@/domain/bot';

import { resetTestDb } from '../../../test/sqlite';

import { deal, PRESET_IDS, PRESETS, presetOf, settingsFor } from './presets';
import { loadGame, recordDart, sessionStats, startGame } from './session';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());

const BOTS = [
  { id: 'bot-2', name: 'DartBot 2', botLevel: 2 },
  { id: 'bot-4', name: 'DartBot 4', botLevel: 4 },
  { id: 'bot-5', name: 'DartBot 5', botLevel: 5 },
];

beforeEach(async () => {
  await resetTestDb();
});

// Every one of the 26 games plays end to end (M5, M11). Bots follow each game's own aim, so a
// finished game also shows the bot strategy works for it.
describe.each(PRESET_IDS)('%s', (presetId) => {
  const { game: id, players } = PRESETS[presetId];
  const bots = BOTS.slice(0, Math.min(3, players.max));
  it('plays to a result with bots, stored and reloaded identically', () => {
    const settings = deal(id, settingsFor(presetId), bots, seeded(3));
    const sessionId = startGame(id, settings, bots);
    let game = loadGame(sessionId);
    const rng = seeded(presetId.length * 7);
    let guard = 0;
    while (game.def.currentPlayer(game.state) && guard++ < 20000) {
      const up = game.def.currentPlayer(game.state)!;
      const t = botThrow(game.def, game.state, up.botLevel!, rng)!;
      game = recordDart(game, { hit: t.hit, point: t.point, source: 'bot', intended: t.intended });
    }
    expect(game.def.result(game.state)).not.toBeNull();
    const reloaded = loadGame(sessionId);
    expect(reloaded.state).toEqual(game.state);
    expect(reloaded.session.endedAt).not.toBeNull();
    for (const p of bots) expect(sessionStats(reloaded, p.id).length).toBeGreaterThan(0);
    expect(presetOf(id, reloaded.session.settings)).toBe(presetId);
  });
});
