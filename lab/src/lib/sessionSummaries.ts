// What Capture lists for each session Lab has (capture-lab.md › API used by Capture), so the
// phone can show sessions it no longer has the photos for (a reinstall, a new bundle ID, a new
// phone) and say which of its own are synced.
import { asc, eq, ne, sql } from 'drizzle-orm';

import { db } from './db/client';
import { captures, sessions, sessionTags } from './db/schema';

export interface LabSessionSummary {
  id: string;
  /** ISO time, as the phone keeps it. */
  startedAt: string;
  tags: string[];
  split: 'train' | 'val' | 'test';
  /** Photos Lab has, rejected ones left out. */
  visits: number;
  labelled: number;
  valuesOnly: number;
  /** Sent to be labelled in Lab, not labelled yet. */
  unlabelled: number;
}

export function sessionSummaries(): LabSessionSummary[] {
  const d = db();
  const counts = d
    .select({
      sessionId: captures.sessionId,
      visits: sql<number>`count(*)`,
      labelled: sql<number>`sum(case when ${captures.status} = 'labelled' then 1 else 0 end)`,
      valuesOnly: sql<number>`sum(case when ${captures.status} = 'values-only' then 1 else 0 end)`,
      unlabelled: sql<number>`sum(case when ${captures.status} = 'unlabelled' then 1 else 0 end)`,
    })
    .from(captures)
    .where(ne(captures.status, 'rejected'))
    .groupBy(captures.sessionId)
    .all();
  const bySession = new Map(counts.map((c) => [c.sessionId, c]));
  const tags = new Map<string, string[]>();
  for (const t of d.select().from(sessionTags).orderBy(asc(sessionTags.tag)).all()) {
    tags.set(t.sessionId, [...(tags.get(t.sessionId) ?? []), t.tag]);
  }
  return d
    .select()
    .from(sessions)
    .where(eq(sessions.source, 'capture'))
    .all()
    .map((s) => {
      const c = bySession.get(s.id);
      return {
        id: s.id,
        startedAt: s.startedAt.toISOString(),
        tags: tags.get(s.id) ?? [],
        split: s.split,
        visits: Number(c?.visits ?? 0),
        labelled: Number(c?.labelled ?? 0),
        valuesOnly: Number(c?.valuesOnly ?? 0),
        unlabelled: Number(c?.unlabelled ?? 0),
      };
    })
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
