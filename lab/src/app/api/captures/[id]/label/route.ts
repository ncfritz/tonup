import { NextResponse } from 'next/server';

import { IngestError, saveLabel } from '~/lib/ingest';
import { labelInput } from '~/lib/labels';
import { getCapture } from '~/lib/queries';

// The label editor saves here: every save is a new label version.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = labelInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad label' },
      { status: 400 },
    );
  }
  try {
    saveLabel(id, parsed.data);
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
  return NextResponse.json(getCapture(id));
}
