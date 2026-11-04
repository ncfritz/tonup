import fs from 'node:fs';

import { NextResponse } from 'next/server';

import { packageDir, packageFiles } from '~/lib/packages';
import { activeModel } from '~/lib/runs';

export const dynamic = 'force-dynamic';

// The model Capture should run (capture-lab.md › Model pull): its name and the files of its
// Core ML package, each fetched from /api/models/<id>/files/<path>. `model` is null when none
// is active; `files` is null when the active one has no package (its export failed).
export function GET() {
  const m = activeModel();
  if (!m) return NextResponse.json({ model: null });
  const dir = packageDir(m.mlpackage);
  const files = dir && fs.existsSync(dir) ? packageFiles(dir) : null;
  return NextResponse.json({
    model: {
      id: m.id,
      name: m.name,
      visitCorrect: m.visitCorrect,
      dartCorrect: m.dartCorrect,
      boardFound: m.boardFound,
      evaluatedOn: m.evaluatedOn,
      files,
    },
  });
}
