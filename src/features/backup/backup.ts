import Constants from 'expo-constants';

import {
  BACKUP_MIME,
  BACKUP_UTI,
  backupFileName,
  buildBackup,
  CSV_MIME,
  CSV_UTI,
  encodeBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
  sessionsToCsv,
  type BackupError,
} from '@/domain/backup';
import i18n from '@/i18n';
import { dumpAll, restore } from '@/services/db/backupRepo';
import { log } from '@/services/diagnostics';
import { pickTextFile, shareTextFile } from '@/services/export';

/** Everything as a versioned JSON file, through the share sheet. */
export async function exportBackup() {
  const data = dumpAll();
  const backup = buildBackup({
    ...data,
    exportedAt: Date.now(),
    app: Constants.expoConfig?.version ?? null,
  });
  await shareTextFile(backupFileName('json'), encodeBackup(backup), {
    mimeType: BACKUP_MIME,
    uti: BACKUP_UTI,
  });
  log('info', 'exported backup', { sessions: data.sessions.length, darts: data.darts.length });
}

/** Sessions as CSV for spreadsheets. False when there's nothing to export. */
export async function exportCsv(): Promise<boolean> {
  const data = dumpAll();
  if (data.sessions.length === 0) return false;
  const t = i18n.getFixedT(null, 'common');
  const csv = sessionsToCsv(data, {
    date: t('data.csv.date'),
    kind: t('data.csv.kind'),
    type: t('data.csv.type'),
    players: t('data.csv.players'),
    winner: t('data.csv.winner'),
    darts: t('data.csv.darts'),
  });
  await shareTextFile(backupFileName('csv'), csv, { mimeType: CSV_MIME, uti: CSV_UTI });
  log('info', 'exported csv', { sessions: data.sessions.length });
  return true;
}

export type ImportResult =
  | { kind: 'done'; sessions: number; skipped: number }
  | { kind: 'canceled' }
  | { kind: 'error'; error: BackupError | 'tooBig' | 'failed' };

/** Picks a backup in Files and adds what isn't here yet. */
export async function importBackup(): Promise<ImportResult> {
  const picked = await pickTextFile([BACKUP_MIME, 'public.json'], MAX_BACKUP_BYTES);
  if (picked === 'canceled') return { kind: 'canceled' };
  if (picked === 'tooBig') return { kind: 'error', error: 'tooBig' };
  return importText(picked.text);
}

/** The import itself, separate from the file picker so it can be tested. */
export function importText(text: string): ImportResult {
  const parsed = parseBackup(text);
  if ('error' in parsed) return { kind: 'error', error: parsed.error };
  try {
    const r = restore(parsed.backup);
    log('info', 'imported backup', r);
    return { kind: 'done', ...r };
  } catch (e) {
    log('error', 'import failed', { error: String(e) });
    return { kind: 'error', error: 'failed' };
  }
}
