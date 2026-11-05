import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '~/lib/db/client';
import { captures } from '~/lib/db/schema';

// Where captures stand, by ID: Capture asks after the photos it sent to label here, to count
// them labelled once they are (capture-lab.md › API used by Capture).
export const dynamic = 'force-dynamic';

const body = z.object({ ids: z.array(z.string().min(1).max(64)).max(500) });

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send { ids: [...] }' }, { status: 400 });
  const { ids } = parsed.data;
  const rows = ids.length
    ? db()
        .select({ id: captures.id, status: captures.status })
        .from(captures)
        .where(inArray(captures.id, ids))
        .all()
    : [];
  return NextResponse.json({ states: Object.fromEntries(rows.map((r) => [r.id, r.status])) });
}
