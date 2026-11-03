// Backups (docs/plan/v1-implementation.md §4): everything as one versioned JSON file, shared
// through the iPhone's share sheet and read back through Files. Nothing leaves the phone
// unless you send the file somewhere (ADR 0001).

export const BACKUP_FORMAT = 'tonup-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_MIME = 'application/json';
export const BACKUP_UTI = 'public.json';
export const CSV_MIME = 'text/csv';
export const CSV_UTI = 'public.comma-separated-values-text';
/** A backup bigger than this is refused on import (about a lifetime of darts). */
export const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface PlayerRow {
  id: string;
  name: string;
  color: string | null;
  botLevel: number | null;
  createdAt: number;
  archivedAt: number | null;
}

export interface SessionRow {
  id: string;
  kind: 'game' | 'drill';
  typeId: string;
  settings: string;
  boardType: 'steel';
  startedAt: number;
  endedAt: number | null;
  abandonedAt: number | null;
  result: string | null;
}

export interface SessionPlayerRow {
  sessionId: string;
  position: number;
  playerId: string;
}

export interface DartRow {
  id: string;
  sessionId: string;
  seq: number;
  playerId: string;
  x: number | null;
  y: number | null;
  segment: number;
  ring: string;
  multiplier: number;
  score: number;
  isDouble: boolean;
  intendedSegment: number | null;
  intendedMultiplier: number | null;
  source: string;
  precision: string;
  corrected: boolean;
  at: number;
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  app: string | null;
  players: PlayerRow[];
  sessions: SessionRow[];
  sessionPlayers: SessionPlayerRow[];
  darts: DartRow[];
}

export function buildBackup(data: Omit<Backup, 'format' | 'version'>): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, ...data };
}

export const encodeBackup = (b: Backup) => JSON.stringify(b);

export type BackupError = 'notJson' | 'notTonUp' | 'newerVersion' | 'malformed';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown) => typeof v === 'string';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const numOrNull = (v: unknown) => v === null || num(v);

/** Reads a backup file, checking its shape before anything touches the database. */
export function parseBackup(text: string): { backup: Backup } | { error: BackupError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'notJson' };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { error: 'notTonUp' };
  if (!num(raw.version)) return { error: 'malformed' };
  if ((raw.version as number) > BACKUP_VERSION) return { error: 'newerVersion' };
  const { players, sessions, sessionPlayers, darts } = raw;
  if (![players, sessions, sessionPlayers, darts].every(Array.isArray))
    return { error: 'malformed' };
  const ok =
    (players as unknown[]).every((p) => isObj(p) && str(p.id) && str(p.name) && num(p.createdAt)) &&
    (sessions as unknown[]).every(
      (s) =>
        isObj(s) &&
        str(s.id) &&
        (s.kind === 'game' || s.kind === 'drill') &&
        str(s.typeId) &&
        str(s.settings) &&
        num(s.startedAt) &&
        numOrNull(s.endedAt ?? null),
    ) &&
    (sessionPlayers as unknown[]).every(
      (r) => isObj(r) && str(r.sessionId) && num(r.position) && str(r.playerId),
    ) &&
    (darts as unknown[]).every(
      (d) =>
        isObj(d) &&
        str(d.id) &&
        str(d.sessionId) &&
        num(d.seq) &&
        str(d.playerId) &&
        num(d.segment) &&
        num(d.multiplier) &&
        num(d.score) &&
        num(d.at),
    );
  if (!ok) return { error: 'malformed' };
  return { backup: raw as unknown as Backup };
}

export function backupFileName(ext: 'json' | 'csv', now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `TonUp-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${ext}`;
}

/** One row per session for spreadsheets: when, what, who, and the result. */
export function sessionsToCsv(
  backup: Pick<Backup, 'players' | 'sessions' | 'sessionPlayers' | 'darts'>,
  headers: {
    date: string;
    kind: string;
    type: string;
    players: string;
    winner: string;
    darts: string;
  },
): string {
  const names = new Map(backup.players.map((p) => [p.id, p.name]));
  const dartCount = new Map<string, number>();
  for (const d of backup.darts) dartCount.set(d.sessionId, (dartCount.get(d.sessionId) ?? 0) + 1);
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    [headers.date, headers.kind, headers.type, headers.players, headers.winner, headers.darts],
  ];
  for (const s of [...backup.sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    const who = backup.sessionPlayers
      .filter((r) => r.sessionId === s.id)
      .sort((a, b) => a.position - b.position)
      .map((r) => names.get(r.playerId) ?? '');
    let winner = '';
    try {
      const r = s.result ? (JSON.parse(s.result) as { winnerId?: string | null }) : null;
      winner = r?.winnerId ? (names.get(r.winnerId) ?? '') : '';
    } catch {
      winner = '';
    }
    rows.push([
      new Date(s.startedAt).toISOString(),
      s.kind,
      s.typeId,
      who.join(' / '),
      winner,
      String(dartCount.get(s.id) ?? 0),
    ]);
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
}
