import { NextResponse } from 'next/server';
import { z } from 'zod';

import { setDeepdartsPath } from '~/lib/deepdarts';

// Where the DeepDarts download is; Lab checks it and training reads it from there.
export async function PUT(req: Request) {
  const body = z.object({ path: z.string().min(1) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Send { path: "/path" }' }, { status: 400 });
  return NextResponse.json(
    setDeepdartsPath(body.data.path.replace(/^~(?=$|\/)/, process.env.HOME ?? '~')),
  );
}
