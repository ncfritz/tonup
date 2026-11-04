import { Overview } from '~/components/Overview';
import { labStatus } from '~/lib/status';

export const dynamic = 'force-dynamic';

// Ant Design's compound components (Layout.Header, Descriptions.Item) only exist on the client,
// so the server reads the status and a client component draws the page.
export default function OverviewPage() {
  return <Overview status={labStatus()} />;
}
