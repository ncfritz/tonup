import { NextResponse } from 'next/server';

import { db } from '~/lib/db/client';
import { sessions } from '~/lib/db/schema';

// The sessions Lab has, by ID: Capture compares its own with these to say which aren't on Lab
// yet and which were deleted here (capture-lab.md › API used by Capture).
export const dynamic = 'force-dynamic';

export function GET() {
  const ids = db()
    .select({ id: sessions.id })
    .from(sessions)
    .all()
    .map((r) => r.id);
  return NextResponse.json({ ids });
}
