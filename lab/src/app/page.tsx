import { Overview } from '~/components/Overview';
import { deepdartsSummary } from '~/lib/deepdarts';
import { overviewCounts } from '~/lib/queries';
import { labStatus } from '~/lib/status';
import { coverage, modelProgress } from '~/lib/verify';

export const dynamic = 'force-dynamic';

// Ant Design's compound components (Layout.Header, Descriptions.Item) only exist on the client,
// so the server reads the data and a client component draws the page.
export default function OverviewPage() {
  return (
    <Overview
      status={labStatus()}
      counts={overviewCounts()}
      deepdarts={deepdartsSummary()}
      progress={modelProgress()}
      coverage={coverage()}
    />
  );
}
