import { NextResponse } from 'next/server';

import { confirmCorrected, IngestError } from '~/lib/ingest';

// "Looks right": a label corrected from the model's pre-fill was checked and needs no change.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return NextResponse.json({ review: confirmCorrected((await params).id) });
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
