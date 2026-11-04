// A model's Core ML package as files (capture-lab.md › Model pull): Capture downloads them one by
// one into its models folder, so neither side needs an archive format.
import fs from 'node:fs';
import path from 'node:path';

import { dataDir } from './env';

export interface PackageFile {
  /** Inside the .mlpackage, with forward slashes ("Data/com.apple.CoreML/model.mlmodel"). */
  path: string;
  size: number;
}

export function packageDir(mlpackage: string | null) {
  return mlpackage ? path.join(dataDir(), mlpackage) : null;
}

export function packageFiles(dir: string): PackageFile[] {
  const out: PackageFile[] = [];
  const walk = (d: string, rel: string[]) => {
    for (const e of fs
      .readdirSync(d, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, [...rel, e.name]);
      else if (e.isFile())
        out.push({ path: [...rel, e.name].join('/'), size: fs.statSync(p).size });
    }
  };
  walk(dir, []);
  return out;
}

/** The file at `parts` inside the package, or null if it isn't one (or tries to leave it). */
export function packageFile(dir: string, parts: string[]): string | null {
  if (!parts.length || parts.some((p) => !p || p === '.' || p === '..' || p.includes('\\')))
    return null;
  const file = path.resolve(dir, ...parts);
  if (!file.startsWith(path.resolve(dir) + path.sep)) return null;
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}
