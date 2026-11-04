import { NextResponse } from 'next/server';

import { deleteCapture, IngestError } from '~/lib/ingest';

// Deletes a capture: its photo, labels and measurements (lib/ingest.ts › deleteCapture).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json(deleteCapture((await params).id));
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
