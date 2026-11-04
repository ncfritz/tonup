'use client';

import { Alert, Card, Col, Descriptions, Row, Statistic, Tag, Typography } from 'antd';
import Link from 'next/link';

import type { DeepdartsSummary } from '~/lib/deepdarts';
import type { OverviewCounts } from '~/lib/queries';
import type { LabStatus } from '~/lib/status';

import { PageBody, PageHeader } from './PageHeader';

/** Overview: the dataset at a glance. Accuracy charts arrive with runs and models (L3, L4). */
export function Overview({
  status,
  counts,
  deepdarts,
}: {
  status: LabStatus;
  counts: OverviewCounts;
  deepdarts: DeepdartsSummary | null;
}) {
  const inUse = counts.bySplit.train + counts.bySplit.val + counts.bySplit.test;
  const pct = (n: number) => (inUse ? `${Math.round((n / inUse) * 100)}%` : '—');
  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="How close the model is to shipping, and what the dataset still needs"
      />
      <PageBody>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Captures" value={counts.captures} />
              <Typography.Text type="secondary">
                {counts.valuesOnly} values only · {counts.rejected} left out
              </Typography.Text>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Sessions" value={counts.sessions} />
              <Link href="/sessions">Import a folder</Link>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="To review" value={counts.toReview} />
              <Link href="/captures?review=1">Open the review queue</Link>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Active model" value={status.activeModel ?? 'None yet'} />
              <Typography.Text type="secondary">Models arrive in L3</Typography.Text>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Sets" size="small">
              <Row gutter={16}>
                {(
                  [
                    ['Train', counts.bySplit.train, 'train'],
                    ['Val', counts.bySplit.val, 'val'],
                    ['Verify', counts.bySplit.test, 'test'],
                  ] as const
                ).map(([name, n, split]) => (
                  <Col span={8} key={split}>
                    <Link href={`/captures?split=${split}`} style={{ color: 'inherit' }}>
                      <Statistic
                        title={name}
                        value={n}
                        suffix={
                          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                            {pct(n)}
                          </Typography.Text>
                        }
                      />
                    </Link>
                  </Col>
                ))}
              </Row>
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                Split by session, 80/10/10. Verify is never trained on.
              </Typography.Paragraph>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Lab" size="small">
              <Descriptions
                column={1}
                size="small"
                items={[
                  { label: 'Version', children: status.version },
                  { label: 'Data folder', children: status.dataDir },
                  {
                    label: 'DeepDarts',
                    children: deepdarts ? (
                      deepdarts.ok ? (
                        `${deepdarts.photos.toLocaleString()} photos`
                      ) : (
                        <Tag color="warning">{deepdarts.problem}</Tag>
                      )
                    ) : (
                      <Link href="/sessions">Not set</Link>
                    ),
                  },
                  {
                    label: 'Shared scoring',
                    children: status.scoring.ok ? (
                      <Tag color="success">self-check {status.scoring.got}</Tag>
                    ) : (
                      <Tag color="error">
                        expected {status.scoring.expected}, got {status.scoring.got}
                      </Tag>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          <Col span={24}>
            <Alert
              type="info"
              showIcon
              title="Accuracy charts, runs and models arrive in L3 and L4"
              description="See docs/plan/capture-lab.md for the milestones."
            />
          </Col>
        </Row>
      </PageBody>
    </>
  );
}
