import { NextResponse } from 'next/server';

import { db } from '~/lib/db/client';
import { sessions } from '~/lib/db/schema';
import { sessionSummaries } from '~/lib/sessionSummaries';

// The sessions Lab has: every ID (Capture compares its own with these to say which aren't on
// Lab yet and which were deleted here), and a summary of each one shot with Capture, so the
// phone can list sessions it hasn't got the photos for (capture-lab.md › API used by Capture).
export const dynamic = 'force-dynamic';

export function GET() {
  const ids = db()
    .select({ id: sessions.id })
    .from(sessions)
    .all()
    .map((r) => r.id);
  return NextResponse.json({ ids, sessions: sessionSummaries() });
}
