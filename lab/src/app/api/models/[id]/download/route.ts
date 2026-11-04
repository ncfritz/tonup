import fs from 'node:fs';
import path from 'node:path';

import { eq } from 'drizzle-orm';
import { zipSync, type Zippable } from 'fflate';
import { NextResponse } from 'next/server';

import { db } from '~/lib/db/client';
import { models } from '~/lib/db/schema';
import { dataDir } from '~/lib/env';

export const dynamic = 'force-dynamic';

/** A directory as fflate's nested tree (a Core ML package is a folder). */
function tree(dir: string): Zippable {
  const out: Zippable = {};
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    out[e.name] = e.isDirectory() ? tree(p) : fs.readFileSync(p);
  }
  return out;
}

// The model's Core ML package as a zip (unzips to DartKeypoints.mlpackage), or with
// ?file=checkpoint its PyTorch checkpoint.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = db()
    .select()
    .from(models)
    .where(eq(models.id, Number((await params).id)))
    .get();
  if (!m) return NextResponse.json({ error: 'No such model' }, { status: 404 });
  if (new URL(req.url).searchParams.get('file') === 'checkpoint') {
    const file = path.join(dataDir(), m.checkpoint);
    if (!fs.existsSync(file))
      return NextResponse.json({ error: 'Checkpoint missing' }, { status: 404 });
    return new NextResponse(fs.readFileSync(file), {
      headers: {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="tonup-${m.name}.pt"`,
      },
    });
  }
  const dir = m.mlpackage ? path.join(dataDir(), m.mlpackage) : null;
  if (!dir || !fs.existsSync(dir))
    return NextResponse.json({ error: 'This model has no Core ML package' }, { status: 404 });
  const zip = zipSync({ [path.basename(dir)]: tree(dir) }, { level: 0 });
  return new NextResponse(Buffer.from(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="DartKeypoints-${m.name}.mlpackage.zip"`,
    },
  });
}
