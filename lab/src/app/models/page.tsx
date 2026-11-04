import { ModelsView } from '~/components/ModelsView';
import { listModels } from '~/lib/runs';

export const dynamic = 'force-dynamic';

export default function ModelsPage() {
  return <ModelsView models={listModels()} />;
}
