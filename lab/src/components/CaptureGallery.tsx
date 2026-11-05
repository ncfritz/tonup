'use client';

import { Empty, Flex, Pagination, Segmented, Select, Typography } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import type { CaptureCard, CaptureFilter } from '~/lib/queries';

import { ReviewTags, SplitTag, StaticOverlay, StatusTag } from './CaptureBits';
import { pageStyles } from './Page';
import { PageBody, PageHeader } from './PageHeader';

const VIEWS = [
  { label: 'All', value: 'all' },
  { label: 'Train', value: 'train' },
  { label: 'Val', value: 'val' },
  { label: 'Verify', value: 'test' },
  { label: 'To review', value: 'review' },
];

export function CaptureGallery({
  filter,
  result,
  sessions,
}: {
  filter: CaptureFilter;
  result: { cards: CaptureCard[]; total: number; page: number; pageSize: number };
  sessions: { id: string; startedAt: number }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = {
      split: filter.split,
      session: filter.sessionId,
      review: filter.review ? '1' : undefined,
      status: filter.status,
      page: undefined as string | undefined,
      ...change,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    router.push(`${pathname}?${next.toString()}`);
  };
  const view = filter.review ? 'review' : (filter.split ?? 'all');

  return (
    <>
      <PageHeader
        title="Captures"
        subtitle={`${result.total.toLocaleString()} photo${result.total === 1 ? '' : 's'} shown`}
      />
      <PageBody>
        <div className={pageStyles.toolbar}>
          <Segmented
            options={VIEWS}
            value={view}
            onChange={(v) =>
              go(
                v === 'review'
                  ? { review: '1', split: undefined }
                  : { review: undefined, split: v === 'all' ? undefined : String(v) },
              )
            }
          />
          <Select
            allowClear
            placeholder="All sessions"
            style={{ minWidth: 220 }}
            value={filter.sessionId}
            onChange={(v?: string) => go({ session: v })}
            options={sessions.map((s) => ({
              value: s.id,
              label: `${new Date(s.startedAt).toLocaleString()} · ${s.id}`,
            }))}
          />
          <Select
            allowClear
            placeholder="Any status"
            style={{ minWidth: 160 }}
            value={filter.status}
            onChange={(v?: string) => go({ status: v })}
            options={[
              { value: 'labelled', label: 'Labelled' },
              { value: 'values-only', label: 'Values only' },
              { value: 'unlabelled', label: 'To label' },
              { value: 'rejected', label: 'Left out' },
            ]}
          />
        </div>

        {result.cards.length === 0 ? (
          <div className={pageStyles.empty}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <>
                  No captures here yet. Import a folder on{' '}
                  <Link href="/sessions?import=1">Sessions</Link>, or sync from TU Capture.
                </>
              }
            />
          </div>
        ) : (
          <div className={pageStyles.tiles}>
            {result.cards.map((c) => (
              <Link key={c.id} href={`/captures/${c.id}`} className={pageStyles.tile}>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: `${c.width} / ${c.height}`,
                    background: '#222',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- local thumbnails */}
                  <img
                    src={`/api/captures/${c.id}/thumb`}
                    alt={`Capture ${c.id}`}
                    loading="lazy"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  />
                  <StaticOverlay
                    width={c.width}
                    height={c.height}
                    points={c.points}
                    darts={c.darts}
                  />
                </div>
                <div className={pageStyles.tileBody}>
                  <Flex justify="space-between" align="center" gap={8}>
                    <Typography.Text strong ellipsis>
                      {c.darts.some((d) => d.entered ?? d.scored)
                        ? c.darts.map((d) => d.entered ?? d.scored ?? '?').join(' · ')
                        : c.darts.length
                          ? `${c.darts.length} dart${c.darts.length === 1 ? '' : 's'}`
                          : 'No darts'}
                    </Typography.Text>
                    <SplitTag split={c.split} />
                  </Flex>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {new Date(c.takenAt).toLocaleString()}
                    {c.angleDeg !== null ? ` · ${Math.round(c.angleDeg)}°` : ''}
                  </Typography.Text>
                  <div style={{ marginTop: 6 }}>
                    <StatusTag status={c.status} />
                    <ReviewTags review={c.review} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {result.total > result.pageSize ? (
          <div className={pageStyles.footer}>
            <Pagination
              current={result.page}
              pageSize={result.pageSize}
              total={result.total}
              showSizeChanger={false}
              onChange={(p) => go({ page: String(p) })}
            />
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
