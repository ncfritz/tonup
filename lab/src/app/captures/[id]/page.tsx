import { notFound } from 'next/navigation';

import { LabelEditor } from '~/components/LabelEditor';
import { getCapture } from '~/lib/queries';

export const dynamic = 'force-dynamic';

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const capture = getCapture((await params).id);
  if (!capture) notFound();
  // Keyed by the current label so a save (router.refresh) resets the editor to what was stored.
  return (
    <LabelEditor
      key={`${capture.id}-${capture.history[0]?.version ?? 0}-${capture.status}`}
      capture={capture}
    />
  );
}
