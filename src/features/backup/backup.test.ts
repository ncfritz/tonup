import { buildBackup, encodeBackup } from '@/domain/backup';
import { hitOf } from '@/domain/darts';
import { X01_DEFAULTS } from '@/domain/games/x01';
import { dumpAll } from '@/services/db/backupRepo';
import { loadDarts, recentSessions } from '@/services/db/sessionsRepo';

import { resetTestDb } from '../../../test/sqlite';
import { loadGame, recordDart, startX01, x01State } from '../game/session';

import { importText } from './backup';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());

const YOU = { id: 'you', name: 'You' };

beforeEach(async () => {
  await resetTestDb();
});

describe('backup and restore', () => {
  it('restores every game and dart into an empty phone, and skips what is already there', async () => {
    const id = startX01(X01_DEFAULTS, [YOU]);
    let g = loadGame(id);
    for (const h of [hitOf(20, 3), hitOf(19, 3)])
      g = recordDart(g, { hit: h, point: null, source: 'keypad' });
    const file = encodeBackup(buildBackup({ ...dumpAll(), exportedAt: 1, app: 'test' }));

    await resetTestDb();
    expect(recentSessions()).toEqual([]);
    expect(importText(file)).toEqual({ kind: 'done', sessions: 1, skipped: 0 });
    expect(loadDarts(id)).toHaveLength(2);
    expect(x01State(loadGame(id)).remaining).toEqual([384]);
    // Importing again adds nothing.
    expect(importText(file)).toEqual({ kind: 'done', sessions: 0, skipped: 1 });
  });

  it('reports files it cannot use', () => {
    expect(importText('nope')).toEqual({ kind: 'error', error: 'notJson' });
    expect(importText('{"format":"x"}')).toEqual({ kind: 'error', error: 'notTonUp' });
  });
});
