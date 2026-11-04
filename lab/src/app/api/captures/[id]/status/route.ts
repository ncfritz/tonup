import { NextResponse } from 'next/server';
import { z } from 'zod';

import { IngestError, setRejected } from '~/lib/ingest';

// Leave a capture out of training, or put it back.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z.object({ rejected: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!body.success)
    return NextResponse.json({ error: 'Send { rejected: boolean }' }, { status: 400 });
  try {
    return NextResponse.json({ status: setRejected(id, body.data.rejected) });
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
