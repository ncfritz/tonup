import fs from 'node:fs';

import { storedFile } from './storage';

/** A stored photo or thumbnail as a response; photos never change once stored. */
export function servePhoto(kind: 'photo' | 'thumb', id: string): Response {
  const file = storedFile(kind, `${id}.jpg`);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(file), {
    headers: {
      'content-type': 'image/jpeg',
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
}
