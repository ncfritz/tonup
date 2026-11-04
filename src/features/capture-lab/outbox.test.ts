import { checkLab, normaliseLabUrl, outcomeOf } from './lab';
import {
  sessionsOn,
  syncOutbox,
  type OutboxStore,
  type SentItem,
  type UploadOutcome,
} from './outbox';
import { newSessionId } from './store';
import type { LabelFile } from './visit';

jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: {},
  UploadType: { MULTIPART: 1 },
}));

function labelOf(id: string, sessionId: string, createdAt: string): LabelFile {
  return {
    id,
    image: `${id}.jpg`,
    width: 4,
    height: 3,
    createdAt,
    sessionId,
    sessionStartedAt: `${createdAt.slice(0, 10)}T00:00:00Z`,
    tags: [],
    calibration: [],
    darts: [],
    valuesOnly: false,
    prefillModel: null,
  };
}

function memoryStore(): OutboxStore & { items: Map<string, SentItem & { sentNow: boolean }> } {
  const items = new Map<string, SentItem & { sentNow: boolean }>();
  return {
    items,
    pending: () => [...items.values()].filter((i) => !i.sentNow),
    sent: () => [...items.values()].filter((i) => i.sentNow),
    put: (label) => items.set(label.id, { id: label.id, label, sentNow: false }),
    photoUri: (id) => `file:///outbox/${id}.jpg`,
    markSent: (id, split) => {
      const i = items.get(id)!;
      items.set(id, { ...i, sentNow: true, split });
    },
    sentPhotoCount: () => 0,
    clearSent: () => 0,
  };
}

describe('syncOutbox', () => {
  it('sends oldest first, keeps refused ones, and stops when Lab is out of reach', async () => {
    const store = memoryStore();
    store.put(labelOf('c', 's1', '2026-11-03T20:03:00Z'), '');
    store.put(labelOf('a', 's1', '2026-11-03T20:01:00Z'), '');
    store.put(labelOf('b', 's1', '2026-11-03T20:02:00Z'), '');
    store.put(labelOf('d', 's1', '2026-11-03T20:04:00Z'), '');
    const seen: string[] = [];
    const outcomes: Record<string, UploadOutcome> = {
      a: { kind: 'sent', split: 'train' },
      b: { kind: 'rejected', error: 'Label file isn’t valid' },
      c: { kind: 'offline', error: 'Network request failed' },
    };
    const result = await syncOutbox(store, async (item, uri) => {
      seen.push(`${item.id}:${uri}`);
      return outcomes[item.id] ?? { kind: 'sent' };
    });
    expect(seen).toEqual([
      'a:file:///outbox/a.jpg',
      'b:file:///outbox/b.jpg',
      'c:file:///outbox/c.jpg',
    ]);
    expect(result).toEqual({
      sent: 1,
      rejected: [{ id: 'b', error: 'Label file isn’t valid' }],
      offline: 'Network request failed',
      left: 3,
    });
    expect(
      store
        .pending()
        .map((i) => i.id)
        .sort(),
    ).toEqual(['b', 'c', 'd']);
  });
});

describe('sessionsOn', () => {
  it('summarises sessions from sent and waiting visits, newest first, with Lab’s split', () => {
    const store = memoryStore();
    store.put(labelOf('a', 's1', '2026-11-01T20:00:00Z'), '');
    store.put(labelOf('b', 's1', '2026-11-01T20:05:00Z'), '');
    store.put(labelOf('c', 's2', '2026-11-03T20:00:00Z'), '');
    store.markSent('a', 'val');
    expect(sessionsOn(store)).toEqual([
      expect.objectContaining({ id: 's2', visits: 1, pending: 1 }),
      expect.objectContaining({ id: 's1', visits: 2, pending: 1, split: 'val' }),
    ]);
  });
});

describe('talking to Lab', () => {
  it('normalises the address', () => {
    expect(normaliseLabUrl(' my-mac.local:3100/ ')).toBe('http://my-mac.local:3100');
    expect(normaliseLabUrl('http://10.0.0.5:3100')).toBe('http://10.0.0.5:3100');
  });

  it('reads upload replies', () => {
    expect(outcomeOf(201, '{"split":"test","created":true}')).toEqual({
      kind: 'sent',
      split: 'test',
    });
    expect(outcomeOf(200, '{"split":"train","created":false}')).toEqual({
      kind: 'sent',
      split: 'train',
    });
    expect(outcomeOf(400, '{"error":"bad"}')).toEqual({ kind: 'rejected', error: 'bad' });
    expect(outcomeOf(502, 'gateway')).toEqual({ kind: 'offline', error: 'Lab answered 502' });
  });

  it('checks the address is Lab', async () => {
    const reply = (body: object, status = 200) =>
      (async () => ({
        ok: status < 400,
        status,
        json: async () => body,
      })) as unknown as typeof fetch;
    expect(
      await checkLab(
        'mac.local:3100',
        reply({ app: 'tonup-lab', version: '0.1.0', activeModel: 'v4', sessions: 3 }),
      ),
    ).toEqual({
      ok: true,
      version: '0.1.0',
      activeModel: 'v4',
      sessions: 3,
    });
    expect(await checkLab('mac.local:3100', reply({ hello: 1 }))).toEqual({
      ok: false,
      error: 'That address isn’t Ton Up Lab',
    });
    const down = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    expect(await checkLab('mac.local:3100', down)).toEqual({
      ok: false,
      error: 'Network request failed',
    });
  });
});

it('makes readable session IDs that Lab accepts', () => {
  const id = newSessionId(new Date(2026, 10, 3, 21, 2), 'A1-B2C3');
  expect(id).toBe('sess-20261103-2102-a1b2');
  expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
});
