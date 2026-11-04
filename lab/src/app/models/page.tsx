import { ModelsView } from '~/components/ModelsView';
import { overviewCounts } from '~/lib/queries';
import { listModels } from '~/lib/runs';
import { modelProgress } from '~/lib/verify';

export const dynamic = 'force-dynamic';

export default function ModelsPage() {
  return (
    <ModelsView
      models={listModels()}
      progress={modelProgress()}
      testPhotos={overviewCounts().bySplit.test}
    />
  );
}
