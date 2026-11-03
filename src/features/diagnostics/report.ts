// Report a problem (docs/design/screens.md → Settings): a plain-text report the user reads and
// sends themselves through the share sheet. Nothing is sent by the app (ADR 0001). It holds no
// names or game data: the app's version, the phone's iOS version, settings, how much is stored,
// and the local diagnostics log.
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { recentLog, storedCounts, type LogRow } from '@/services/diagnostics';
import { shareTextFile } from '@/services/export';

import { usePro } from '../pro/pro';
import { useSettings } from '../settings/store';

export const SUPPORT_EMAIL = 'support@tonup.app';

export interface ReportInput {
  note: string;
  now?: number;
  log?: LogRow[];
  counts?: { sessions: number; darts: number };
}

export function buildReport({ note, now = Date.now(), log, counts }: ReportInput): string {
  const s = useSettings.getState();
  const rows = log ?? recentLog();
  const stored = counts ?? storedCounts();
  const lines = [
    'Ton Up problem report',
    `Created: ${new Date(now).toISOString()}`,
    `App: ${Constants.expoConfig?.version ?? '?'} (${Constants.expoConfig?.ios?.buildNumber ?? '?'})`,
    `iOS: ${String(Platform.Version)}`,
    `Pro: ${usePro.getState().owned ? 'yes' : 'no'}`,
    `Theme: ${s.theme} · ${s.appearance}`,
    `Input: ${s.defaultInput} · caller ${s.caller ? 'on' : 'off'} · haptics ${s.haptics ? 'on' : 'off'}`,
    `Stored: ${stored.sessions} sessions, ${stored.darts} darts`,
    '',
    'What happened:',
    note.trim() || '(not described)',
    '',
    `Log (newest first, ${rows.length} rows):`,
    ...rows.map(
      (r) =>
        `${new Date(r.createdAt).toISOString()} ${r.level.toUpperCase()} ${r.message}${r.context ? ` ${r.context}` : ''}`,
    ),
  ];
  return lines.join('\n') + '\n';
}

export async function shareReport(note: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  await shareTextFile(`tonup-report-${stamp}.txt`, buildReport({ note }), {
    mimeType: 'text/plain',
    uti: 'public.plain-text',
  });
}
