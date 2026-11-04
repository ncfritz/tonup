// The outbox on the phone: Documents/outbox/<id>.jpg and <id>.json, moved to Documents/sent/
// once Lab has them (docs/plan/capture-lab.md › Outbox and upload). No database.
import { Directory, File, Paths } from 'expo-file-system';

import { log } from '@/services/diagnostics';

import type { OutboxItem, OutboxStore, SentItem } from './outbox';
import type { LabelFile } from './visit';

const dir = (name: 'outbox' | 'sent') => {
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
    new File(photoUri).copySync(new File(out, `${label.id}.jpg`));
    const meta = new File(out, `${label.id}.json`);
    meta.create({ overwrite: true });
    meta.writeSync(JSON.stringify(label));
  },
  photoUri: (id) => new File(dir('outbox'), `${id}.jpg`).uri,
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
};
