import { backupFileName, buildBackup, encodeBackup, parseBackup, sessionsToCsv } from '.';

const sample = buildBackup({
  exportedAt: 1,
  app: '0.1.0',
  players: [
    { id: 'you', name: 'You', color: null, botLevel: null, createdAt: 1, archivedAt: null },
  ],
  sessions: [
    {
      id: 's1',
      kind: 'game',
      typeId: 'x01',
      settings: '{}',
      boardType: 'steel',
      startedAt: Date.UTC(2026, 10, 2),
      endedAt: 2,
      abandonedAt: null,
      result: '{"winnerId":"you","score":{"you":1}}',
    },
  ],
  sessionPlayers: [{ sessionId: 's1', position: 0, playerId: 'you' }],
  darts: [],
});

describe('backups', () => {
  it('round-trips', () => {
    expect(parseBackup(encodeBackup(sample))).toEqual({ backup: sample });
  });

  it('refuses files that are not ours, newer, or broken', () => {
    expect(parseBackup('not json')).toEqual({ error: 'notJson' });
    expect(parseBackup('{"format":"other"}')).toEqual({ error: 'notTonUp' });
    expect(parseBackup(JSON.stringify({ ...sample, version: 99 }))).toEqual({
      error: 'newerVersion',
    });
    expect(parseBackup(JSON.stringify({ ...sample, darts: [{ id: 1 }] }))).toEqual({
      error: 'malformed',
    });
  });

  it('names files by date and writes a CSV of sessions', () => {
    expect(backupFileName('json', new Date(2026, 10, 2))).toBe('TonUp-2026-11-02.json');
    const csv = sessionsToCsv(sample, {
      date: 'Date',
      kind: 'Kind',
      type: 'Game',
      players: 'Players',
      winner: 'Winner',
      darts: 'Darts',
    });
    expect(csv).toBe(
      'Date,Kind,Game,Players,Winner,Darts\n2026-11-02T00:00:00.000Z,game,x01,You,You,0\n',
    );
  });
});
