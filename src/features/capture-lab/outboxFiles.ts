// The outbox on the phone: Documents/outbox/<id>.jpg and <id>.json, moved to Documents/sent/
// once Lab has them (docs/plan/capture-lab.md › Outbox and upload). Photos saved to label later
// wait in Documents/drafts until they're labelled. No database.
import { Directory, File, Paths } from 'expo-file-system';

import { log } from '@/services/diagnostics';

import type { Draft, DraftStore, OutboxItem, OutboxStore, SentItem } from './outbox';
import type { LabelFile } from './visit';

const dir = (name: 'outbox' | 'sent' | 'drafts') => {
  const d = new Directory(Paths.document, name);
  if (!d.exists) d.create({ intermediates: true });
  return d;
};

function read(name: 'outbox' | 'sent'): SentItem[] {
  const items: SentItem[] = [];
  for (const entry of dir(name).list()) {
    if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
    try {
      const data = JSON.parse(entry.textSync()) as LabelFile & { split?: SentItem['split'] };
      const { split, ...label } = data;
      items.push({ id: label.id, label, ...(split ? { split } : {}) });
    } catch (e) {
      log('warn', 'capture outbox: unreadable label file', { name: entry.name, error: String(e) });
    }
  }
  return items;
}

export const fileOutbox: OutboxStore = {
  pending: (): OutboxItem[] => read('outbox'),
  sent: () => read('sent'),
  put(label, photoUri) {
    const out = dir('outbox');
    const photo = new File(out, `${label.id}.jpg`);
    // Labelled again while still waiting: the photo is already here.
    if (new File(photoUri).uri !== photo.uri) new File(photoUri).copySync(photo);
    const meta = new File(out, `${label.id}.json`);
    meta.create({ overwrite: true });
    meta.writeSync(JSON.stringify(label));
    // Labelled again (tips added to a values-only visit): the copy Lab had goes, the new one waits.
    const sent = dir('sent');
    for (const name of [`${label.id}.json`, `${label.id}.jpg`]) {
      const f = new File(sent, name);
      if (f.exists) f.delete();
    }
  },
  photoUri: (id) => new File(dir('outbox'), `${id}.jpg`).uri,
  sentPhotoUri(id) {
    const f = new File(dir('sent'), `${id}.jpg`);
    return f.exists ? f.uri : null;
  },
  markSent(id, split) {
    const out = dir('outbox');
    const sent = dir('sent');
    new File(out, `${id}.jpg`).moveSync(new File(sent, `${id}.jpg`));
    const json = new File(out, `${id}.json`);
    const label = JSON.parse(json.textSync()) as LabelFile;
    const dest = new File(sent, `${id}.json`);
    dest.create({ overwrite: true });
    dest.writeSync(JSON.stringify({ ...label, ...(split ? { split } : {}) }));
    json.delete();
  },
  sentPhotoCount: () =>
    dir('sent')
      .list()
      .filter((e) => e instanceof File && e.name.endsWith('.jpg')).length,
  clearSent() {
    let n = 0;
    for (const entry of dir('sent').list()) {
      if (entry instanceof File && entry.name.endsWith('.jpg')) {
        entry.delete();
        n++;
      }
    }
    return n;
  },
  forgetSent(sessionId) {
    let n = 0;
    const sent = dir('sent');
    for (const item of read('sent')) {
      if (item.label.sessionId !== sessionId) continue;
      for (const name of [`${item.id}.json`, `${item.id}.jpg`]) {
        const f = new File(sent, name);
        if (f.exists) f.delete();
      }
      n++;
    }
    return n;
  },
};

export const fileDrafts: DraftStore = {
  list() {
    const out: Draft[] = [];
    for (const entry of dir('drafts').list()) {
      if (!(entry instanceof File) || !entry.name.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(entry.textSync()) as Draft);
      } catch (e) {
        log('warn', 'capture drafts: unreadable file', { name: entry.name, error: String(e) });
      }
    }
    return out;
  },
  put(draft, photoUri) {
    const d = dir('drafts');
    new File(photoUri).copySync(new File(d, `${draft.id}.jpg`));
    const meta = new File(d, `${draft.id}.json`);
    meta.create({ overwrite: true });
    meta.writeSync(JSON.stringify(draft));
  },
  photoUri: (id) => new File(dir('drafts'), `${id}.jpg`).uri,
  remove(id) {
    const d = dir('drafts');
    for (const name of [`${id}.jpg`, `${id}.json`]) {
      const f = new File(d, name);
      if (f.exists) f.delete();
    }
  },
};
