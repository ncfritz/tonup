import { SessionsView } from '~/components/SessionsView';
import { deepdartsSummary } from '~/lib/deepdarts';
import { listSessions } from '~/lib/queries';

export const dynamic = 'force-dynamic';

export default function SessionsPage() {
  return <SessionsView sessions={listSessions()} deepdarts={deepdartsSummary()} />;
}
