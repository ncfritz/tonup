// Talking to Ton Up Lab on the Mac (docs/plan/capture-lab.md › API used by Capture): plain HTTP
// on the local network, no auth (ADR 0012).
import { File, UploadType } from 'expo-file-system';

import type { OutboxItem, UploadOutcome } from './outbox';

export type LabHealth =
  | { ok: true; version: string; activeModel: string | null; sessions: number }
  | { ok: false; error: string };

/** "neils-mbp.local:3100" → "http://neils-mbp.local:3100"; trailing slashes dropped. */
export function normaliseLabUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(u) ? u : `http://${u}`;
}

export async function checkLab(url: string, fetchImpl: typeof fetch = fetch): Promise<LabHealth> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetchImpl(`${normaliseLabUrl(url)}/api/health`, {
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `Lab answered ${res.status}` };
    const body = (await res.json()) as {
      app?: string;
      version?: string;
      activeModel?: string | null;
      sessions?: number;
    };
    if (body.app !== 'tonup-lab') return { ok: false, error: 'That address isn’t Ton Up Lab' };
    return {
      ok: true,
      version: body.version ?? '?',
      activeModel: body.activeModel ?? null,
      sessions: body.sessions ?? 0,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/** Reads Lab's reply to an upload. */
export function outcomeOf(status: number, body: string): UploadOutcome {
  let parsed: { split?: 'train' | 'val' | 'test'; error?: string } = {};
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    // Not JSON: judge by the status alone.
  }
  if (status === 200 || status === 201) return { kind: 'sent', split: parsed.split };
  if (status >= 400 && status < 500) {
    return { kind: 'rejected', error: parsed.error ?? `Lab refused it (${status})` };
  }
  return { kind: 'offline', error: parsed.error ?? `Lab answered ${status}` };
}

/** Sends one visit: multipart with the photo as "photo" and the label file as "label". */
export function uploader(url: string) {
  return async (item: OutboxItem, photoUri: string): Promise<UploadOutcome> => {
    try {
      const res = await new File(photoUri).upload(`${normaliseLabUrl(url)}/api/captures`, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'photo',
        mimeType: 'image/jpeg',
        parameters: { label: JSON.stringify(item.label) },
      });
      return outcomeOf(res.status, res.body);
    } catch (e) {
      return { kind: 'offline', error: e instanceof Error ? e.message : String(e) };
    }
  };
}
