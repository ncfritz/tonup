'use client';

import { Flex, Table, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { ModelProgress, VerificationListItem } from '~/lib/verify';

import { NewVerificationButton, type ModelOption } from './NewVerification';
import { pageStyles, Section } from './Page';
import { PageBody, PageHeader } from './PageHeader';
import { pct, RunStatus } from './RunBits';
import { BAR } from './RunCharts';
import { ProgressChart } from './VerifyCharts';

const when = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function Score({ v, bar }: { v: number; bar: number }) {
  return <Typography.Text type={v >= bar ? undefined : 'warning'}>{pct(v)}</Typography.Text>;
}

export function VerificationsView({
  items,
  progress,
  models,
  testPhotos,
}: {
  items: VerificationListItem[];
  progress: ModelProgress;
  models: ModelOption[];
  testPhotos: number;
}) {
  const router = useRouter();
  const live = items.some((i) => i.run.status === 'queued' || i.run.status === 'running');
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [live, router]);

  return (
    <>
      <PageHeader
        title="Verification"
        subtitle={`Models checked on the verify set: ${testPhotos.toLocaleString()} photos from sessions never trained on`}
        extra={<NewVerificationButton models={models} testPhotos={testPhotos} />}
      />
      <PageBody>
        <Section title="Accuracy by model (each model’s latest verification)">
          <ProgressChart models={progress} />
        </Section>
        <Table
          className={pageStyles.flush}
          size="small"
          rowKey={(i) => i.run.id}
          dataSource={items}
          pagination={false}
          scroll={{ x: 760 }}
          locale={{ emptyText: 'No verifications yet' }}
          columns={[
            {
              title: 'Run',
              render: (_, i) => <Link href={`/verification/${i.run.id}`}>#{i.run.id}</Link>,
            },
            {
              title: 'What',
              render: (_, i) =>
                i.run.kind === 'verify' ? (
                  <>Verify {i.models.join(' vs ')}</>
                ) : (
                  <>Training check of {i.models[0] ?? 'a new model'}</>
                ),
            },
            { title: 'Status', render: (_, i) => <RunStatus run={i.run} /> },
            {
              title: `Visit · Segment · Board`,
              render: (_, i) =>
                i.results.length ? (
                  <Flex vertical gap={2}>
                    {i.results.map((r) => (
                      <span key={r.modelId}>
                        <b style={{ display: 'inline-block', minWidth: 30 }}>{r.model}</b>{' '}
                        <Score v={r.visitCorrect} bar={BAR.visit} /> ·{' '}
                        <Score v={r.dartCorrect} bar={BAR.dart} /> ·{' '}
                        <Score v={r.boardFound} bar={BAR.board} />
                      </span>
                    ))}
                  </Flex>
                ) : (
                  '—'
                ),
            },
            {
              title: 'Photos',
              render: (_, i) => {
                const r = i.results[0];
                return r ? (
                  <>
                    {r.samples}
                    {r.valuesOnly ? (
                      <Tag style={{ marginLeft: 6 }}>{r.valuesOnly} values only</Tag>
                    ) : null}
                  </>
                ) : (
                  '—'
                );
              },
            },
            { title: 'When', render: (_, i) => when(i.run.createdAt) },
          ]}
        />
      </PageBody>
    </>
  );
}
