// Capture's outbox (docs/plan/capture-lab.md › Outbox and upload): a saved visit is a photo
// and its label file waiting to go to Lab. Sync sends them in order and moves each one to
// "sent" when Lab has it; nothing is lost if Lab is off or out of reach.
import type { LabelFile } from './visit';

export interface OutboxItem {
  id: string;
  label: LabelFile;
}

export interface SentItem extends OutboxItem {
  /** The set Lab put the session in, from its reply. */
  split?: 'train' | 'val' | 'test';
}

/** Where the outbox lives; the app uses the phone's Documents folder (outboxFiles.ts). */
export interface OutboxStore {
  pending(): OutboxItem[];
  sent(): SentItem[];
  /** Adds a visit: copies the photo in and writes its label file. */
  put(label: LabelFile, photoUri: string): void;
  photoUri(id: string): string;
  /** Moves a visit from the outbox to sent, noting Lab's split. */
  markSent(id: string, split?: SentItem['split']): void;
  /** Photos still kept for visits Lab already has. */
  sentPhotoCount(): number;
  /** Deletes the sent photos (Lab has them; the label files stay for the session list). */
  clearSent(): number;
}

export type UploadOutcome =
  | { kind: 'sent'; split?: SentItem['split'] }
  /** Lab refused it (a bad label): it stays in the outbox and is reported. */
  | { kind: 'rejected'; error: string }
  /** Lab couldn't be reached: stop and try again later. */
  | { kind: 'offline'; error: string };

export interface SyncResult {
  sent: number;
  rejected: { id: string; error: string }[];
  offline: string | null;
  left: number;
}

export async function syncOutbox(
  store: OutboxStore,
  upload: (item: OutboxItem, photoUri: string) => Promise<UploadOutcome>,
): Promise<SyncResult> {
  const items = store.pending().sort((a, b) => a.label.createdAt.localeCompare(b.label.createdAt));
  const result: SyncResult = { sent: 0, rejected: [], offline: null, left: items.length };
  for (const item of items) {
    const outcome = await upload(item, store.photoUri(item.id));
    if (outcome.kind === 'offline') {
      result.offline = outcome.error;
      break;
    }
    if (outcome.kind === 'rejected') {
      result.rejected.push({ id: item.id, error: outcome.error });
      continue;
    }
    store.markSent(item.id, outcome.split);
    result.sent++;
    result.left--;
  }
  return result;
}

export interface SessionSummary {
  id: string;
  startedAt: string;
  tags: string[];
  visits: number;
  pending: number;
  split?: SentItem['split'];
}

/** Sessions on this phone, newest first, from what's in the outbox and sent. */
export function sessionsOn(store: OutboxStore): SessionSummary[] {
  const byId = new Map<string, SessionSummary>();
  const add = (item: SentItem, pending: boolean) => {
    const l = item.label;
    const s = byId.get(l.sessionId) ?? {
      id: l.sessionId,
      startedAt: l.sessionStartedAt,
      tags: l.tags,
      visits: 0,
      pending: 0,
    };
    s.visits++;
    if (pending) s.pending++;
    if (item.split) s.split = item.split;
    byId.set(l.sessionId, s);
  };
  for (const i of store.sent()) add(i, false);
  for (const i of store.pending()) add(i, true);
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
