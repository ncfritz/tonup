import { NextResponse } from 'next/server';

import { sessionPlan } from '~/lib/reads';

export const dynamic = 'force-dynamic';

// What the phone should do for a session (capture-lab.md › Model reads): its set, and whether the
// model reads its visits. Asked when a session starts; the session needn't exist in Lab yet.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'Not a session ID' }, { status: 400 });
  }
  return NextResponse.json(sessionPlan(id));
}
