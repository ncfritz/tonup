import { servePhoto } from '~/lib/serve';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return servePhoto('thumb', (await params).id);
}
