import { VerificationsView } from '~/components/VerificationsView';
import { overviewCounts } from '~/lib/queries';
import { listModels } from '~/lib/runs';
import { listVerifications, modelProgress } from '~/lib/verify';

export const dynamic = 'force-dynamic';

export default function VerificationPage() {
  return (
    <VerificationsView
      items={listVerifications()}
      progress={modelProgress()}
      models={listModels().map(({ id, name, status }) => ({ id, name, status }))}
      testPhotos={overviewCounts().bySplit.test}
    />
  );
}
