import { notFound } from 'next/navigation';

import { VerifyView } from '~/components/VerifyView';
import { readLog } from '~/lib/runs';
import { getVerification } from '~/lib/verify';

export const dynamic = 'force-dynamic';

export default async function VerificationRunPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const data = getVerification(id);
  if (!data) notFound();
  return <VerifyView data={data} initialLog={readLog(id).tail} />;
}
