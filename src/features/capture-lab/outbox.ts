// Capture's outbox (docs/plan/capture-lab.md › Outbox and upload): a saved visit is a photo
// and its label file waiting to go to Lab. Sync sends them in order and moves each one to
// "sent" when Lab has it; nothing is lost if Lab is off or out of reach.
import { visitTotal, type LabelFile, type SessionInfo } from './visit';

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
  /** A sent visit's photo, or null once it's been cleared (Lab has it). */
  sentPhotoUri(id: string): string | null;
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

/**
 * A photo saved with "Label later": kept on the phone, and not sent, until it's labelled
 * (docs/plan/capture-lab.md › Label later). Labelling it makes a visit with the same ID.
 */
export interface Draft {
  id: string;
  createdAt: string;
  session: SessionInfo;
  width: number;
  height: number;
  zoom?: number;
}

/** Where drafts live; the app uses Documents/drafts (outboxFiles.ts). */
export interface DraftStore {
  list(): Draft[];
  put(draft: Draft, photoUri: string): void;
  photoUri(id: string): string;
  /** Drops a draft once it's been labelled (its photo has gone to the outbox). */
  remove(id: string): void;
}

export type PhotoStatus = 'labelled' | 'values-only' | 'unlabelled';

export interface SessionSummary {
  id: string;
  startedAt: string;
  tags: string[];
  /** Every photo in the session: labelled, values only and still to label. */
  visits: number;
  labelled: number;
  valuesOnly: number;
  unlabelled: number;
  /** Visits waiting in the outbox. */
  pending: number;
  split?: SentItem['split'];
}

/** Sessions on this phone, newest first, from the outbox, sent visits and drafts. */
export function sessionsOn(store: OutboxStore, drafts?: DraftStore): SessionSummary[] {
  const byId = new Map<string, SessionSummary>();
  const entry = (id: string, startedAt: string, tags: string[]) => {
    const s = byId.get(id) ?? {
      id,
      startedAt,
      tags,
      visits: 0,
      labelled: 0,
      valuesOnly: 0,
      unlabelled: 0,
      pending: 0,
    };
    byId.set(id, s);
    return s;
  };
  const add = (item: SentItem, pending: boolean) => {
    const l = item.label;
    const s = entry(l.sessionId, l.sessionStartedAt, l.tags);
    s.visits++;
    if (l.valuesOnly) s.valuesOnly++;
    else s.labelled++;
    if (pending) s.pending++;
    if (item.split) s.split = item.split;
  };
  for (const i of store.sent()) add(i, false);
  for (const i of store.pending()) add(i, true);
  for (const d of drafts?.list() ?? []) {
    const s = entry(d.session.id, d.session.startedAt, d.session.tags);
    s.visits++;
    s.unlabelled++;
  }
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export interface SessionPhoto {
  id: string;
  createdAt: string;
  status: PhotoStatus;
  /** The visit's total, once the values are in. */
  total: number | null;
  /** Null when the photo's been cleared from the phone. */
  uri: string | null;
}

/** One session's photos, in the order they were taken. */
export function sessionPhotos(
  store: OutboxStore,
  drafts: DraftStore,
  sessionId: string,
): SessionPhoto[] {
  const out: SessionPhoto[] = [];
  const add = (item: OutboxItem, uri: string | null) => {
    if (item.label.sessionId !== sessionId) return;
    out.push({
      id: item.id,
      createdAt: item.label.createdAt,
      status: item.label.valuesOnly ? 'values-only' : 'labelled',
      total: visitTotal(item.label.darts.map((d) => d.value)),
      uri,
    });
  };
  for (const i of store.sent()) add(i, store.sentPhotoUri(i.id));
  for (const i of store.pending()) add(i, store.photoUri(i.id));
  for (const d of drafts.list()) {
    if (d.session.id !== sessionId) continue;
    out.push({
      id: d.id,
      createdAt: d.createdAt,
      status: 'unlabelled',
      total: null,
      uri: drafts.photoUri(d.id),
    });
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * The drafts to label, oldest first: one session's, or with `except` every session but that
 * one (Home's "Label all", which leaves the session still being shot alone).
 */
export function labelQueue(
  drafts: DraftStore,
  which: { session: string } | { except: string | null },
): string[] {
  return drafts
    .list()
    .filter((d) =>
      'session' in which ? d.session.id === which.session : d.session.id !== which.except,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((d) => d.id);
}
