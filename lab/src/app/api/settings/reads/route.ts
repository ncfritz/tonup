import { NextResponse } from 'next/server';
import { z } from 'zod';

import { blindAgreement, readsSettings, setReadsSettings } from '~/lib/reads';

export const dynamic = 'force-dynamic';

const body = z.object({
  mode: z.enum(['off', 'train']).optional(),
  every: z.number().int().min(2).max(100).optional(),
});

// Model reads' settings (Overview › Model reads), with how blind checks are going.
export function GET() {
  return NextResponse.json({ ...readsSettings(), agreement: blindAgreement() });
}

export async function PUT(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Not valid settings' }, { status: 400 });
  return NextResponse.json({ ...setReadsSettings(parsed.data), agreement: blindAgreement() });
}
