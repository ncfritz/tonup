import { inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '~/lib/db/client';
import { models } from '~/lib/db/schema';
import { tick } from '~/lib/runner';
import { createTrainRun, listRuns, trainParams } from '~/lib/runs';
import { createVerifyRun, verifyParams } from '~/lib/verify';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(listRuns());
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });

// Queues a run (a training run, or with "kind": "verify" a verification run); the runner
// starts it when nothing else is running.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { kind?: string } | null;
  if (body?.kind === 'verify') {
    const parsed = verifyParams.safeParse(body);
    if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Bad run settings');
    const known = db()
      .select({ id: models.id })
      .from(models)
      .where(inArray(models.id, parsed.data.modelIds))
      .all();
    if (known.length !== parsed.data.modelIds.length) return bad('No such model');
    const run = createVerifyRun(parsed.data);
    tick();
    return NextResponse.json(run, { status: 201 });
  }
  const parsed = trainParams.safeParse(body);
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Bad run settings');
  const run = createTrainRun(parsed.data);
  tick();
  return NextResponse.json(run, { status: 201 });
}
