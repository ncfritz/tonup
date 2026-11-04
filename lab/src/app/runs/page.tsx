import { RunsView } from '~/components/RunsView';
import { deepdartsPath } from '~/lib/deepdarts';
import { overviewCounts } from '~/lib/queries';
import { DEFAULTS, listModels, listRuns } from '~/lib/runs';

export const dynamic = 'force-dynamic';

export default function RunsPage() {
  return (
    <RunsView
      runs={listRuns()}
      models={listModels().map((m) => ({ id: m.id, name: m.name, status: m.status }))}
      defaults={DEFAULTS}
      hasDeepdarts={!!deepdartsPath()}
      counts={overviewCounts().bySplit}
    />
  );
}
