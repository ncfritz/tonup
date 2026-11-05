'use client';

import {
  AimOutlined,
  AppstoreOutlined,
  FilterOutlined,
  UnorderedListOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Empty, Flex, Pagination, Progress, Segmented, Select, Tag, Typography } from 'antd';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import type { CaptureCard, CaptureFilter, CaptureView, SessionGroup } from '~/lib/queries';
import type { Coverage } from '~/lib/verify';

import { ReviewTags, SplitTag, StaticOverlay, StatusTag } from './CaptureBits';
import { pageStyles } from './Page';
import styles from './CaptureGallery.module.css';
import { HitBoard } from './HitBoard';
import { PageHeader } from './PageHeader';
import { SideTabs } from './SideTabs';

const VIEWS: { label: string; value: CaptureView }[] = [
  { label: 'All', value: 'all' },
  { label: 'Train', value: 'train' },
  { label: 'Val', value: 'val' },
  { label: 'Verify', value: 'test' },
  { label: 'To review', value: 'review' },
];

/** How the photos are laid out: one grid, newest first, or a row per session. */
export type GalleryLayout = 'grid' | 'sessions';

export function CaptureGallery({
  filter,
  layout,
  result,
  groups,
  sessions,
  counts,
  coverage,
  hits,
}: {
  filter: CaptureFilter;
  layout: GalleryLayout;
  /** The grid's page (layout "grid"). */
  result: { cards: CaptureCard[]; total: number; page: number; pageSize: number };
  /** The page of session rows (layout "sessions"). */
  groups: { rows: SessionGroup[]; total: number; page: number; pageSize: number } | null;
  sessions: { id: string; startedAt: number }[];
  counts: Record<CaptureView, number>;
  coverage: Coverage[];
  hits: { hits: Record<string, number>; darts: number };
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
      layout: layout === 'sessions' ? 'sessions' : undefined,
      page: undefined as string | undefined,
      ...change,
    };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    router.push(`${pathname}?${next.toString()}`);
  };
  const view: CaptureView = filter.review ? 'review' : (filter.split ?? 'all');
  const pickView = (v: CaptureView) =>
    go(
      v === 'review'
        ? { review: '1', split: undefined }
        : { review: undefined, split: v === 'all' ? undefined : v },
    );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Captures"
        subtitle={`${result.total.toLocaleString()} photo${result.total === 1 ? '' : 's'} shown`}
      />
      <div className={pageStyles.toolbar}>
        <Segmented<GalleryLayout>
          value={layout}
          onChange={(v) => go({ layout: v === 'sessions' ? 'sessions' : undefined })}
          options={[
            { value: 'grid', label: 'By date', icon: <AppstoreOutlined /> },
            { value: 'sessions', label: 'By session', icon: <UnorderedListOutlined /> },
          ]}
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
      <div className={styles.work}>
        <div className={styles.scroll}>
          {result.total === 0 ? (
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
          ) : layout === 'sessions' && groups ? (
            <>
              {groups.rows.map((g) => (
                <section
                  key={g.session.id}
                  className={styles.sessionRow}
                  aria-label={`Session ${g.session.id}`}
                >
                  <div className={styles.sessionHead}>
                    <Typography.Text strong>
                      {new Date(g.session.startedAt).toLocaleString()}
                    </Typography.Text>
                    <SplitTag split={g.session.split} />
                    {g.session.tags.map((t) => (
                      <Tag key={t} bordered={false}>
                        {t}
                      </Tag>
                    ))}
                    <Typography.Text type="secondary">
                      {g.total} photo{g.total === 1 ? '' : 's'}
                    </Typography.Text>
                    <span className={styles.flex} />
                    {g.total > g.cards.length ? (
                      <Link href={`/captures?session=${encodeURIComponent(g.session.id)}`}>
                        All {g.total}
                      </Link>
                    ) : null}
                  </div>
                  <div className={styles.strip}>
                    {g.cards.map((c) => (
                      <Tile key={c.id} c={c} className={`${styles.card} ${styles.stripTile}`} />
                    ))}
                    {g.total > g.cards.length ? (
                      <Link
                        href={`/captures?session=${encodeURIComponent(g.session.id)}`}
                        className={styles.more}
                      >
                        {g.total - g.cards.length} more
                      </Link>
                    ) : null}
                  </div>
                </section>
              ))}
              {groups.total > groups.pageSize ? (
                <div className={pageStyles.footer}>
                  <Pagination
                    current={groups.page}
                    pageSize={groups.pageSize}
                    total={groups.total}
                    showSizeChanger={false}
                    onChange={(p) => go({ page: String(p) })}
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className={styles.grid}>
                {result.cards.map((c) => (
                  <Tile key={c.id} c={c} className={styles.card} />
                ))}
              </div>
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
            </>
          )}
        </div>
        <SideTabs
          id="captures"
          width={480}
          tabs={[
            {
              key: 'show',
              icon: <FilterOutlined />,
              title: 'Show',
              flush: true,
              children: (
                <>
                  <nav aria-label="Which captures" className={styles.views}>
                    {VIEWS.map((v) => (
                      <button
                        key={v.value}
                        type="button"
                        aria-current={view === v.value ? 'true' : undefined}
                        className={`${styles.view} ${view === v.value ? styles.viewOn : ''}`}
                        onClick={() => pickView(v.value)}
                      >
                        <span>{v.label}</span>
                        <span className={styles.viewCount}>{counts[v.value].toLocaleString()}</span>
                      </button>
                    ))}
                  </nav>
                  <div className={styles.paneSection}>
                    <Typography.Text strong>Coverage</Typography.Text>
                    <Typography.Text type="secondary" className={styles.small}>
                      Labelled photos in each condition, across the dataset. Thin: fewer than 30, or
                      fewer than 10 kept for verification.
                    </Typography.Text>
                    {coverage.map((c) => (
                      <CoverageBlock key={c.key} c={c} />
                    ))}
                  </div>
                </>
              ),
            },
            {
              key: 'hits',
              icon: <AimOutlined />,
              title: 'Where darts landed',
              children: <HitBoard hits={hits.hits} darts={hits.darts} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

/** A photo's tile: its thumbnail with its label drawn over it, the darts, set and status. */
function Tile({ c, className }: { c: CaptureCard; className?: string }) {
  return (
    <Link href={`/captures/${c.id}`} className={className}>
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
        <StaticOverlay width={c.width} height={c.height} points={c.points} darts={c.darts} />
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
  );
}

/** One condition's buckets: a bar each against the condition's largest, thin ones in amber. */
function CoverageBlock({ c }: { c: Coverage }) {
  const max = Math.max(1, ...c.buckets.map((b) => b.training + b.verify));
  return (
    <div className={styles.coverage}>
      <div className={styles.coverageHead}>
        <Typography.Text>{c.title}</Typography.Text>
        {c.unmeasured ? (
          <Typography.Text type="secondary" className={styles.small}>
            {c.unmeasured} not measured
          </Typography.Text>
        ) : null}
      </div>
      {c.buckets.map((b) => {
        const n = b.training + b.verify;
        return (
          <div key={b.bucket} className={styles.bucket}>
            <Typography.Text type={b.thin ? 'warning' : undefined} className={styles.bucketName}>
              {b.thin ? <WarningOutlined /> : null} {b.bucket}
            </Typography.Text>
            <Progress
              percent={(n / max) * 100}
              showInfo={false}
              size="small"
              status={b.thin ? 'exception' : 'normal'}
              strokeColor={b.thin ? 'var(--ant-color-warning)' : undefined}
              className={styles.bucketBar}
            />
            <span className={styles.bucketCount}>
              {n}
              <Typography.Text type="secondary" className={styles.small}>
                {' '}
                · {b.verify} verify
              </Typography.Text>
            </span>
          </div>
        );
      })}
    </div>
  );
}
