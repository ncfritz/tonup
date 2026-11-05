import { NextResponse } from 'next/server';

import { getVerification } from '~/lib/verify';

export const dynamic = 'force-dynamic';

// A verification as Lab's Verification page shows it (results per model, by condition, the
// worst photos), for Capture's verify run screen (capture-lab.md › API used by Capture).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const v = getVerification(Number((await params).id));
  return v ? NextResponse.json(v) : NextResponse.json({ error: 'No such run' }, { status: 404 });
}
