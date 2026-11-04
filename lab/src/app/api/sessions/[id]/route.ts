import { NextResponse } from 'next/server';

import { deleteSession, IngestError } from '~/lib/ingest';

// Deletes a session and all its captures (lib/ingest.ts › deleteSession).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(deleteSession((await params).id));
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
