import { NextResponse } from 'next/server';

import { activateModel } from '~/lib/runs';

// The active model is the one Capture pre-fills with (capture-lab.md › Model pull).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = activateModel(Number((await params).id));
  return m ? NextResponse.json(m) : NextResponse.json({ error: 'No such model' }, { status: 404 });
}
