import fs from 'node:fs';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '~/lib/db/client';
import { models } from '~/lib/db/schema';
import { packageDir, packageFile } from '~/lib/packages';

export const dynamic = 'force-dynamic';

// One file of a model's Core ML package, for Capture's model pull.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> },
) {
  const p = await params;
  const m = db()
    .select()
    .from(models)
    .where(eq(models.id, Number(p.id)))
    .get();
  const dir = packageDir(m?.mlpackage ?? null);
  const file = dir ? packageFile(dir, p.path.map(decodeURIComponent)) : null;
  if (!file) return NextResponse.json({ error: 'No such file' }, { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: {
      'content-type': 'application/octet-stream',
      'content-length': String(fs.statSync(file).size),
    },
  });
}
