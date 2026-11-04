import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { packageFile, packageFiles } from './packages';

let dir: string;
beforeEach(() => {
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lab-pkg-')), 'DartKeypoints.mlpackage');
  fs.mkdirSync(path.join(dir, 'Data', 'com.apple.CoreML', 'weights'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Manifest.json'), '{}');
  fs.writeFileSync(path.join(dir, 'Data', 'com.apple.CoreML', 'model.mlmodel'), 'spec');
  fs.writeFileSync(
    path.join(dir, 'Data', 'com.apple.CoreML', 'weights', 'weight.bin'),
    'w'.repeat(10),
  );
  fs.writeFileSync(path.join(dir, '..', 'secret.txt'), 'no');
});
afterEach(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true }));

describe('model packages', () => {
  it('lists every file with its size, in a stable order', () => {
    expect(packageFiles(dir)).toEqual([
      { path: 'Data/com.apple.CoreML/model.mlmodel', size: 4 },
      { path: 'Data/com.apple.CoreML/weights/weight.bin', size: 10 },
      { path: 'Manifest.json', size: 2 },
    ]);
  });

  it('serves files inside the package only', () => {
    expect(packageFile(dir, ['Manifest.json'])).toBe(path.join(dir, 'Manifest.json'));
    expect(packageFile(dir, ['..', 'secret.txt'])).toBeNull();
    expect(packageFile(dir, ['Data'])).toBeNull();
    expect(packageFile(dir, [])).toBeNull();
  });
});
