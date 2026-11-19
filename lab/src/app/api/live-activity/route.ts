import { NextResponse } from 'next/server';
import { z } from 'zod';

import { liveActivityStatus, registerToken } from '~/lib/liveActivity';

export const dynamic = 'force-dynamic';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const body = z.object({
  kind: z.enum(['start', 'activity']),
  token: z.string().regex(/^[0-9a-f]{16,400}$/),
  activityId: z.string().min(1).max(200).optional(),
  colors: z
    .object({
      accent: color,
      onAccent: color,
      text: color,
      muted: color,
      surface: color,
      danger: color,
      ok: color,
    })
    .optional(),
});

// The run Live Activity (capture-lab.md › Live Activity): whether push is set up (Runs page),
// and the phone's tokens: `start` to start one when a run begins, `activity` to update it.
export function GET() {
  return NextResponse.json(liveActivityStatus());
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Not a valid token' }, { status: 400 });
  if (parsed.data.kind === 'activity' && !parsed.data.activityId)
    return NextResponse.json({ error: 'An activity token needs its activity' }, { status: 400 });
  return NextResponse.json(await registerToken(parsed.data));
}
