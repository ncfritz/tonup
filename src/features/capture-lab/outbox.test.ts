import { checkLab, normaliseLabUrl, outcomeOf } from './lab';
import {
  labelQueue,
  sessionPhotos,
  sessionsOn,
  syncOutbox,
  type Draft,
  type DraftStore,
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
    sentPhotoUri: (id) => (id === 'cleared' ? null : `file:///sent/${id}.jpg`),
    markSent: (id, split) => {
      const i = items.get(id)!;
      items.set(id, { ...i, sentNow: true, split });
    },
    sentPhotoCount: () => 0,
    clearSent: () => 0,
  };
}

function memoryDrafts(): DraftStore & { items: Map<string, Draft> } {
  const items = new Map<string, Draft>();
  return {
    items,
    list: () => [...items.values()],
    put: (d) => items.set(d.id, d),
    photoUri: (id) => `file:///drafts/${id}.jpg`,
    remove: (id) => items.delete(id),
  };
}

const draftOf = (id: string, sessionId: string, createdAt: string): Draft => ({
  id,
  createdAt,
  session: { id: sessionId, startedAt: `${createdAt.slice(0, 10)}T00:00:00Z`, tags: [] },
  width: 4,
  height: 4,
});

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

describe('labelling later', () => {
  const setUp = () => {
    const store = memoryStore();
    const drafts = memoryDrafts();
    store.put(
      {
        ...labelOf('a', 's1', '2026-11-01T20:00:00Z'),
        darts: [
          { x: 0, y: 0, value: 'T20' },
          { x: 0, y: 0, value: '5' },
        ],
      },
      '',
    );
    store.put({ ...labelOf('b', 's1', '2026-11-01T20:05:00Z'), valuesOnly: true }, '');
    store.put(labelOf('cleared', 's1', '2026-11-01T20:06:00Z'), '');
    store.markSent('a', 'val');
    store.markSent('cleared', 'val');
    drafts.put(draftOf('d2', 's1', '2026-11-01T20:03:00Z'), '');
    drafts.put(draftOf('d1', 's1', '2026-11-01T20:01:00Z'), '');
    drafts.put(draftOf('d3', 's2', '2026-11-03T20:00:00Z'), '');
    return { store, drafts };
  };

  it('counts labelled, values-only and unlabelled photos per session', () => {
    const { store, drafts } = setUp();
    expect(sessionsOn(store, drafts)).toEqual([
      expect.objectContaining({ id: 's2', visits: 1, labelled: 0, valuesOnly: 0, unlabelled: 1 }),
      expect.objectContaining({
        id: 's1',
        visits: 5,
        labelled: 2,
        valuesOnly: 1,
        unlabelled: 2,
        pending: 1,
        split: 'val',
      }),
    ]);
  });

  it('lists a session’s photos in the order they were taken, with totals', () => {
    const { store, drafts } = setUp();
    expect(sessionPhotos(store, drafts, 's1')).toEqual([
      {
        id: 'a',
        createdAt: '2026-11-01T20:00:00Z',
        status: 'labelled',
        total: 65,
        uri: 'file:///sent/a.jpg',
      },
      {
        id: 'd1',
        createdAt: '2026-11-01T20:01:00Z',
        status: 'unlabelled',
        total: null,
        uri: 'file:///drafts/d1.jpg',
      },
      {
        id: 'd2',
        createdAt: '2026-11-01T20:03:00Z',
        status: 'unlabelled',
        total: null,
        uri: 'file:///drafts/d2.jpg',
      },
      {
        id: 'b',
        createdAt: '2026-11-01T20:05:00Z',
        status: 'values-only',
        total: 0,
        uri: 'file:///outbox/b.jpg',
      },
      { id: 'cleared', createdAt: '2026-11-01T20:06:00Z', status: 'labelled', total: 0, uri: null },
    ]);
  });

  it('queues one session’s drafts, or every session’s but the one being shot', () => {
    const { drafts } = setUp();
    expect(labelQueue(drafts, { session: 's1' })).toEqual(['d1', 'd2']);
    expect(labelQueue(drafts, { except: 's2' })).toEqual(['d1', 'd2']);
    expect(labelQueue(drafts, { except: null })).toEqual(['d1', 'd2', 'd3']);
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
