import { CaptureGallery } from '~/components/CaptureGallery';
import {
  hitCounts,
  listCaptures,
  listCaptureSessions,
  listSessions,
  viewCounts,
  type CaptureFilter,
} from '~/lib/queries';
import { coverage } from '~/lib/verify';

export const dynamic = 'force-dynamic';

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CapturesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const split = one(q.split);
  const status = one(q.status);
  const filter: CaptureFilter = {
    split: split === 'train' || split === 'val' || split === 'test' ? split : undefined,
    sessionId: one(q.session) || undefined,
    review: one(q.review) === '1',
    status:
      status === 'labelled' ||
      status === 'values-only' ||
      status === 'unlabelled' ||
      status === 'rejected'
        ? status
        : undefined,
    page: Number(one(q.page) ?? 1) || 1,
  };
  const layout = one(q.layout) === 'sessions' ? 'sessions' : 'grid';
  const result = listCaptures(layout === 'grid' ? filter : { ...filter, page: 1, pageSize: 0 });
  const groups = layout === 'sessions' ? listCaptureSessions(filter) : null;
  const sessions = listSessions().map((s) => ({ id: s.id, startedAt: s.startedAt }));
  return (
    <CaptureGallery
      filter={filter}
      layout={layout}
      result={result}
      groups={groups}
      sessions={sessions}
      counts={viewCounts(filter)}
      coverage={coverage()}
      hits={hitCounts(filter)}
    />
  );
}
