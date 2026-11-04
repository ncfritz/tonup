import { NextResponse } from 'next/server';

import { ingestCapture, IngestError } from '~/lib/ingest';

// Ton Up Capture's upload (capture-lab.md › API used by Capture): multipart with the photo and
// its label file. Idempotent by capture ID, so the phone can retry freely.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }
  const photo = form.get('photo');
  const label = form.get('label');
  if (!(photo instanceof Blob) || typeof label !== 'string') {
    return NextResponse.json(
      { error: 'Send "photo" (a file) and "label" (JSON)' },
      { status: 400 },
    );
  }
  let meta: unknown;
  try {
    meta = JSON.parse(label);
  } catch {
    return NextResponse.json({ error: '"label" isn’t JSON' }, { status: 400 });
  }
  try {
    const result = await ingestCapture(meta, Buffer.from(await photo.arrayBuffer()), 'phone');
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof IngestError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
