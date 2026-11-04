import { NextResponse } from 'next/server';
import { z } from 'zod';

import { importFolder, IngestError } from '~/lib/ingest';

// Imports a folder on this Mac: Ton Up's captures copied off the phone, or Capture's outbox.
export async function POST(req: Request) {
  const body = z
    .object({ folder: z.string().min(1) })
    .safeParse(await req.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: 'Send { folder: "/path" }' }, { status: 400 });
  try {
    return NextResponse.json(
      await importFolder(body.data.folder.replace(/^~(?=$|\/)/, process.env.HOME ?? '~')),
    );
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
