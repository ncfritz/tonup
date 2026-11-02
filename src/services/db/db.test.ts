import { hitOf, type DartEvent } from '@/domain/darts';

import { resetTestDb } from '../../../test/sqlite';

import { listPlayers, savePlayer } from './playersRepo';
import {
  abandonSession,
  appendDart,
  createSession,
  deleteSession,
  getSession,
  latestFinished,
  latestUnfinished,
  loadDarts,
  readCachedStat,
  replaceDartsFrom,
  setResult,
  writeCachedStat,
} from './sessionsRepo';
import { readAllSettings, writeSetting } from './settingsRepo';

jest.mock('@/services/db/client', () => jest.requireActual('../../../test/sqlite').testClient());

const A = { id: 'a', name: 'Alice' };
const BOT = { id: 'bot4', name: 'DartBot 4', botLevel: 4 };

const dart = (seq: number, overrides: Partial<DartEvent> = {}): DartEvent => ({
  id: `d${seq}`,
  sessionId: 's1',
  playerId: 'a',
  seq,
  point: { x: 1.5, y: 103 },
  hit: hitOf(20, 3),
  intended: { segment: 20, multiplier: 3 },
  source: 'tap',
  precision: 'exact',
  corrected: false,
  at: 1000 + seq,
  ...overrides,
});

beforeEach(async () => {
  await resetTestDb();
});

describe('migrations', () => {
  it('create every table', async () => {
    const { raw } = await resetTestDb();
    const tables = raw
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining([
        'darts',
        'diagnostics_log',
        'players',
        'session_players',
        'sessions',
        'settings',
        'stats_cache',
      ]),
    );
  });
});

describe('settings', () => {
  it('round-trips JSON values and overwrites', () => {
    writeSetting('appearance', 'dark');
    writeSetting('appearance', 'light');
    writeSetting('haptics', false);
    expect(readAllSettings()).toEqual({ appearance: 'light', haptics: false });
  });
});

describe('players', () => {
  it('saves people and bots and updates names', () => {
    savePlayer(A, 1);
    savePlayer(BOT, 2);
    savePlayer({ ...A, name: 'Ali' }, 3);
    expect(listPlayers()).toEqual([{ id: 'a', name: 'Ali' }, BOT]);
  });
});

describe('sessions and darts', () => {
  const start = (id = 's1', startedAt = 1) =>
    createSession({
      id,
      kind: 'game',
      typeId: 'x01',
      settings: { startScore: 501 },
      players: [A, BOT],
      startedAt,
    });

  it('stores a session with its players in order', () => {
    start();
    expect(getSession('s1')).toMatchObject({
      typeId: 'x01',
      settings: { startScore: 501 },
      players: [A, BOT],
      endedAt: null,
      result: null,
    });
    expect(getSession('nope')).toBeNull();
  });

  it('round-trips darts exactly, including keypad darts with no point', () => {
    start();
    const keypad = dart(1, {
      point: null,
      hit: hitOf(25, 2),
      intended: undefined,
      source: 'keypad',
      precision: 'segment',
    });
    appendDart(dart(0));
    appendDart(keypad);
    expect(loadDarts('s1')).toEqual([dart(0), keypad]);
  });

  it('refuses two darts with the same position in a session', () => {
    start();
    appendDart(dart(0));
    expect(() => appendDart(dart(0, { id: 'other' }))).toThrow();
  });

  it('replaces darts from a position on (undo and edit)', () => {
    start();
    [0, 1, 2].forEach((i) => appendDart(dart(i)));
    replaceDartsFrom('s1', 1, [dart(1, { hit: hitOf(1, 1), corrected: true })]);
    expect(loadDarts('s1').map((d) => [d.seq, d.hit.score, d.corrected])).toEqual([
      [0, 60, false],
      [1, 1, true],
    ]);
  });

  it('finds the latest unfinished session, skipping finished and abandoned ones', () => {
    start('s1', 1);
    start('s2', 2);
    start('s3', 3);
    setResult('s3', { winnerId: 'a' }, 10);
    expect(latestUnfinished()).toBe('s2');
    abandonSession('s2');
    expect(latestUnfinished('game')).toBe('s1');
    expect(latestUnfinished('drill')).toBeNull();
    expect(latestFinished('game')).toBe('s3');
    expect(latestFinished('drill')).toBeNull();
  });

  it('caches stats until the darts change, and ignores old versions', () => {
    start();
    writeCachedStat('s1', 'a', 'x01', 1, { average: 60 });
    expect(readCachedStat('s1', 'a', 'x01', 1)).toEqual({ average: 60 });
    expect(readCachedStat('s1', 'a', 'x01', 2)).toBeUndefined();
    appendDart(dart(0));
    expect(readCachedStat('s1', 'a', 'x01', 1)).toBeUndefined();
  });

  it('deletes a session with its darts', () => {
    start();
    appendDart(dart(0));
    deleteSession('s1');
    expect(loadDarts('s1')).toEqual([]);
    expect(getSession('s1')).toBeNull();
  });
});
