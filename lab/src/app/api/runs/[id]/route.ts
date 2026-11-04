import { NextResponse } from 'next/server';

import { getRun } from '~/lib/runs';

export const dynamic = 'force-dynamic';

// A run with its per-epoch metrics and the end of its log; the Run page polls this.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = getRun(Number((await params).id));
  return run
    ? NextResponse.json(run)
    : NextResponse.json({ error: 'No such run' }, { status: 404 });
}
