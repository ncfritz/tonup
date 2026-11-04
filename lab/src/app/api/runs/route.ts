import { NextResponse } from 'next/server';

import { tick } from '~/lib/runner';
import { createTrainRun, listRuns, trainParams } from '~/lib/runs';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listRuns());
}

// Queues a training run; the runner starts it when nothing else is running.
export async function POST(req: Request) {
  const parsed = trainParams.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Bad run settings' },
      { status: 400 },
    );
  }
  const run = createTrainRun(parsed.data);
  tick();
  return NextResponse.json(run, { status: 201 });
}
