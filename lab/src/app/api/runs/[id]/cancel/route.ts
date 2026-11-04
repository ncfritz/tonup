import { NextResponse } from 'next/server';

import { cancelRun } from '~/lib/runner';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return cancelRun(Number((await params).id))
    ? NextResponse.json({ ok: true })
    : NextResponse.json(
        { error: 'Only a queued or running run can be cancelled' },
        { status: 409 },
      );
}
