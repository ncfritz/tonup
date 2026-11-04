// Pulling Lab's active model into Capture (docs/plan/capture-lab.md › Model pull): its Core ML
// package comes down file by file into a staging folder, replaces the model in Documents/models
// (where dart-vision looks) only once every file has arrived whole, and dart-vision reloads.
// The pre-fill then comes from the model Lab says is best, and labels record its name.
import { fetchActiveModel, modelFileUrl, type ActiveModel } from './lab';

/** The model this phone has from Lab. */
export interface InstalledModel {
  id: number;
  name: string;
  installedAt: string;
}

/** The phone's side: files in Documents/models (modelFiles.ts), injectable for tests. */
export interface ModelStore {
  installed(): InstalledModel | null;
  /** Empties the staging folder. */
  beginStaging(): void;
  /** Downloads one file into the staging package at `path`; resolves to its size in bytes. */
  download(url: string, path: string): Promise<number>;
  /** Swaps the staged package in for the current model and records it. */
  commit(model: InstalledModel): void;
  discardStaging(): void;
}

export type PullStatus =
  | { kind: 'unreachable'; error: string }
  | { kind: 'none' }
  | { kind: 'no-package'; name: string }
  | { kind: 'current'; name: string }
  | { kind: 'available'; model: ActiveModel };

/** What Lab has against what's on the phone. */
export async function checkForModel(
  labUrl: string,
  store: ModelStore,
  fetchImpl?: typeof fetch,
): Promise<PullStatus> {
  const reply = await fetchActiveModel(labUrl, fetchImpl);
  if (!reply.ok) return { kind: 'unreachable', error: reply.error };
  const m = reply.model;
  if (!m) return { kind: 'none' };
  if (!m.files?.length) return { kind: 'no-package', name: m.name };
  if (store.installed()?.id === m.id) return { kind: 'current', name: m.name };
  return { kind: 'available', model: m };
}

export type PullResult = { ok: true; name: string } | { ok: false; error: string };

/** Downloads `model` and installs it; the old model stays if anything goes wrong. */
export async function pullModel(
  labUrl: string,
  model: ActiveModel,
  store: ModelStore,
  reload: () => Promise<{ model: boolean; version: string | null }>,
  onProgress: (done: number, total: number) => void = () => {},
  now = () => new Date(),
): Promise<PullResult> {
  const files = model.files ?? [];
  const total = files.reduce((s, f) => s + f.size, 0);
  let done = 0;
  try {
    store.beginStaging();
    onProgress(0, total);
    for (const f of files) {
      const size = await store.download(modelFileUrl(labUrl, model.id, f.path), f.path);
      if (size !== f.size)
        throw new Error(`${f.path} arrived incomplete (${size} of ${f.size} bytes)`);
      done += f.size;
      onProgress(done, total);
    }
    store.commit({ id: model.id, name: model.name, installedAt: now().toISOString() });
  } catch (e) {
    store.discardStaging();
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const caps = await reload();
  if (!caps.model) return { ok: false, error: 'Downloaded, but the model wouldn’t load' };
  return { ok: true, name: model.name };
}
