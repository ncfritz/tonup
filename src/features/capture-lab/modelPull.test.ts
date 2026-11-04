import { modelFileUrl } from './lab';
import { checkForModel, pullModel, type InstalledModel, type ModelStore } from './modelPull';

const active = {
  id: 7,
  name: 'v3',
  visitCorrect: 0.91,
  files: [
    { path: 'Manifest.json', size: 10 },
    { path: 'Data/com.apple.CoreML/model.mlmodel', size: 200 },
    { path: 'Data/com.apple.CoreML/weights/weight.bin', size: 5000 },
  ],
};

function fakeStore(installed: InstalledModel | null = null, sizes: Record<string, number> = {}) {
  const calls: string[] = [];
  const store: ModelStore & { calls: string[]; current: InstalledModel | null } = {
    calls,
    current: installed,
    installed: () => store.current,
    beginStaging: () => calls.push('stage'),
    download: async (url, path) => {
      calls.push(`get ${url}`);
      return sizes[path] ?? active.files.find((f) => f.path === path)!.size;
    },
    commit: (m) => {
      calls.push(`commit ${m.name}`);
      store.current = m;
    },
    discardStaging: () => calls.push('discard'),
  };
  return store;
}

const reply = (body: unknown, status = 200) =>
  (async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;

describe('checking for a model', () => {
  it('reports what Lab has against what the phone has', async () => {
    const lab = 'mac.local:3100';
    expect(await checkForModel(lab, fakeStore(), reply({ model: null }))).toEqual({ kind: 'none' });
    expect(
      await checkForModel(lab, fakeStore(), reply({ model: { ...active, files: null } })),
    ).toEqual({ kind: 'no-package', name: 'v3' });
    expect(await checkForModel(lab, fakeStore(), reply({ model: active }))).toEqual({
      kind: 'available',
      model: active,
    });
    const have = { id: 7, name: 'v3', installedAt: '2026-11-04T10:00:00Z' };
    expect(await checkForModel(lab, fakeStore(have), reply({ model: active }))).toEqual({
      kind: 'current',
      name: 'v3',
    });
    expect(await checkForModel(lab, fakeStore(), reply({}, 500))).toMatchObject({
      kind: 'unreachable',
    });
  });
});

describe('pulling a model', () => {
  it('downloads every file, then installs and reloads', async () => {
    const store = fakeStore();
    const progress: number[] = [];
    const reload = jest.fn(async () => ({ model: true, version: 'v3' }));
    const r = await pullModel(
      'mac.local:3100',
      active,
      store,
      reload,
      (done) => progress.push(done),
      () => new Date('2026-11-04T10:00:00Z'),
    );
    expect(r).toEqual({ ok: true, name: 'v3' });
    expect(store.calls).toEqual([
      'stage',
      'get http://mac.local:3100/api/models/7/files/Manifest.json',
      'get http://mac.local:3100/api/models/7/files/Data/com.apple.CoreML/model.mlmodel',
      'get http://mac.local:3100/api/models/7/files/Data/com.apple.CoreML/weights/weight.bin',
      'commit v3',
    ]);
    expect(progress).toEqual([0, 10, 210, 5210]);
    expect(store.current).toEqual({ id: 7, name: 'v3', installedAt: '2026-11-04T10:00:00.000Z' });
    expect(reload).toHaveBeenCalled();
  });

  it('keeps the old model when a file arrives short', async () => {
    const old = { id: 6, name: 'v2', installedAt: '2026-11-01T10:00:00Z' };
    const store = fakeStore(old, { 'Data/com.apple.CoreML/weights/weight.bin': 100 });
    const reload = jest.fn();
    const r = await pullModel('mac.local:3100', active, store, reload);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('incomplete') });
    expect(store.calls.at(-1)).toBe('discard');
    expect(store.current).toBe(old);
    expect(reload).not.toHaveBeenCalled();
  });

  it('says so when the new model won’t load', async () => {
    const r = await pullModel('mac.local:3100', active, fakeStore(), async () => ({
      model: false,
      version: null,
    }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('wouldn’t load') });
  });

  it('escapes file names in the URL', () => {
    expect(modelFileUrl('http://m:3100/', 1, 'Data/a b.bin')).toBe(
      'http://m:3100/api/models/1/files/Data/a%20b.bin',
    );
  });
});
