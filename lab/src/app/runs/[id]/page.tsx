import { notFound } from 'next/navigation';

import { RunView } from '~/components/RunView';
import { getRun } from '~/lib/runs';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const data = getRun(Number((await params).id));
  if (!data) notFound();
  return <RunView initial={data} />;
}
