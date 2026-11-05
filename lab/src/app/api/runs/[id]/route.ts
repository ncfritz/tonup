import { NextResponse } from 'next/server';

import { runComparison } from '~/lib/phone';
import { getRun } from '~/lib/runs';

export const dynamic = 'force-dynamic';

// A run with its per-epoch metrics and the end of its log; the Run page polls this. Capture's
// past run also reads what it made and the model it started from (`comparison`).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const run = getRun(id);
  return run
    ? NextResponse.json({ ...run, comparison: runComparison(id) })
    : NextResponse.json({ error: 'No such run' }, { status: 404 });
}
