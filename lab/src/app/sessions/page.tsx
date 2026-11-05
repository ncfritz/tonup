import { SessionsView } from '~/components/SessionsView';
import { deepdartsSummary } from '~/lib/deepdarts';
import { listSessions } from '~/lib/queries';

export const dynamic = 'force-dynamic';

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ import?: string }>;
}) {
  const { import: open } = await searchParams;
  return (
    <SessionsView
      sessions={listSessions()}
      deepdarts={deepdartsSummary()}
      openImport={open === '1'}
    />
  );
}
