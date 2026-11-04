// The model on the phone: Documents/models/DartKeypoints.mlpackage, where dart-vision looks
// (modules/dart-vision/ios/DartVisionModule.swift), with installed.json saying which Lab model it
// is. A pull stages into Documents/models/.incoming first (modelPull.ts).
import { Directory, File, Paths } from 'expo-file-system';

import { log } from '@/services/diagnostics';

import type { InstalledModel, ModelStore } from './modelPull';

const PACKAGE = 'DartKeypoints.mlpackage';

const modelsDir = () => {
  const d = new Directory(Paths.document, 'models');
  if (!d.exists) d.create({ intermediates: true });
  return d;
};
const stagingDir = () => new Directory(modelsDir(), '.incoming');
const record = () => new File(modelsDir(), 'installed.json');

function remove(entry: File | Directory) {
  if (entry.exists) entry.delete();
}

export const modelFiles: ModelStore = {
  installed() {
    const f = record();
    if (!f.exists || !new Directory(modelsDir(), PACKAGE).exists) return null;
    try {
      return JSON.parse(f.textSync()) as InstalledModel;
    } catch (e) {
      log('warn', 'capture model: unreadable installed.json', { error: String(e) });
      return null;
    }
  },
  beginStaging() {
    remove(stagingDir());
    new Directory(stagingDir(), PACKAGE).create({ intermediates: true });
  },
  async download(url, path) {
    const parts = path.split('/');
    const name = parts.pop()!;
    const dir = new Directory(stagingDir(), PACKAGE, ...parts);
    if (!dir.exists) dir.create({ intermediates: true });
    const file = await File.downloadFileAsync(url, new File(dir, name), { idempotent: true });
    return file.size;
  },
  commit(model) {
    const dir = modelsDir();
    remove(new Directory(dir, PACKAGE));
    // A model dropped in by hand would load before the package (dart-vision's order): it goes.
    remove(new Directory(dir, 'DartKeypoints.mlmodelc'));
    remove(new File(dir, 'DartKeypoints.mlmodel'));
    new Directory(stagingDir(), PACKAGE).moveSync(dir);
    remove(stagingDir());
    const f = record();
    f.create({ overwrite: true });
    f.writeSync(JSON.stringify(model));
  },
  discardStaging() {
    try {
      remove(stagingDir());
    } catch (e) {
      log('warn', 'capture model: could not clear staging', { error: String(e) });
    }
  },
};
