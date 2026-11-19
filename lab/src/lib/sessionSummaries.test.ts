import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { closeDbForTests, db } from './db/client';
import { captures, sessions, sessionTags } from './db/schema';
import { sessionSummaries } from './sessionSummaries';

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-sessions-'));
  process.env.TONUP_LAB_DATA = dir;
  closeDbForTests();
});
afterEach(() => {
  closeDbForTests();
  fs.rmSync(dir, { recursive: true, force: true });
});

function session(id: string, startedAt: string, source: 'capture' | 'import' = 'capture') {
  db()
    .insert(sessions)
    .values({ id, startedAt: new Date(startedAt), split: 'train', source, createdAt: new Date() })
    .run();
}
function capture(
  id: string,
  sessionId: string,
  status: 'labelled' | 'values-only' | 'unlabelled' | 'rejected',
) {
  db()
    .insert(captures)
    .values({
      id,
      sessionId,
      photo: `${id}.jpg`,
      width: 100,
      height: 100,
      takenAt: new Date(),
      status,
      createdAt: new Date(),
    })
    .run();
}

describe('session summaries for the phone', () => {
  it('counts each Capture session’s photos by status, newest first, with its tags', () => {
    session('s-old', '2026-11-01T10:00:00.000Z');
    session('s-new', '2026-11-18T10:00:00.000Z');
    session('imported', '2026-11-10T10:00:00.000Z', 'import');
    db()
      .insert(sessionTags)
      .values([
        { sessionId: 's-new', tag: 'lamp' },
        { sessionId: 's-new', tag: 'close' },
      ])
      .run();
    capture('a', 's-new', 'labelled');
    capture('b', 's-new', 'values-only');
    capture('c', 's-new', 'unlabelled');
    capture('d', 's-new', 'rejected');
    capture('e', 'imported', 'labelled');

    expect(sessionSummaries()).toEqual([
      {
        id: 's-new',
        startedAt: '2026-11-18T10:00:00.000Z',
        tags: ['close', 'lamp'],
        split: 'train',
        visits: 3,
        labelled: 1,
        valuesOnly: 1,
        unlabelled: 1,
      },
      {
        id: 's-old',
        startedAt: '2026-11-01T10:00:00.000Z',
        tags: [],
        split: 'train',
        visits: 0,
        labelled: 0,
        valuesOnly: 0,
        unlabelled: 0,
      },
    ]);
  });
});
