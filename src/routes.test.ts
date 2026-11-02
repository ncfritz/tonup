import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Every route file loads in isolation and has a default export (expo-router requires it). */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

const app = join(__dirname, 'app');

describe('route modules', () => {
  it('src/app holds no test files (expo-router would bundle them as routes)', () => {
    expect(files(app).filter((f) => /\.test\./.test(f))).toEqual([]);
  });

  for (const file of files(app).filter((f) => /\.tsx?$/.test(f))) {
    it(`${relative(app, file)} loads and exports a component`, () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- loading each route file
      const mod = require(file);
      expect(typeof mod.default).toBe('function');
    });
  }
});
