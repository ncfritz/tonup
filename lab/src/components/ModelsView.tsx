'use client';

import { DownloadOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Dropdown, Flex, Row, Space, Table, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { ModelProgress } from '~/lib/verify';

import { useStartVerification } from './NewVerification';
import { PageBody, PageHeader } from './PageHeader';
import { pct } from './RunBits';
import { BAR } from './RunCharts';
import { ProgressChart } from './VerifyCharts';

export interface ModelListItem {
  id: number;
  name: string;
  runId: number;
  status: 'candidate' | 'active' | 'retired';
  createdAt: number;
  mlpackage: string | null;
  evaluatedOn: string | null;
  samples: number | null;
  visitCorrect: number | null;
  dartCorrect: number | null;
  boardFound: number | null;
}

const STATUS = {
  candidate: <Tag color="orange">Candidate</Tag>,
  active: <Tag color="cyan">Active</Tag>,
  retired: <Tag>Retired</Tag>,
};

function Score({ v, bar }: { v: number | null; bar: number }) {
  if (v == null) return <>—</>;
  return (
    <Typography.Text type={v >= bar ? undefined : 'warning'}>
      {v >= bar ? '✓ ' : ''}
      {pct(v)}
    </Typography.Text>
  );
}

/** The models runs have produced: numbers from each one's latest verification, compare, ship. */
export function ModelsView({
  models,
  progress,
  testPhotos,
}: {
  models: ModelListItem[];
  progress: ModelProgress;
  testPhotos: number;
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const start = useStartVerification();
  const [selected, setSelected] = useState<number[]>([]);
  const activate = async (id: number) => {
    const res = await fetch(`/api/models/${id}/activate`, { method: 'POST' });
    if (!res.ok) return message.error('Couldn’t set it active');
    message.success('Capture will pre-fill with this model');
    router.refresh();
  };
  // Compare in the order trained, so the older model is the baseline the deltas are against.
  const compare = () => start([...selected].sort((a, b) => a - b));
  return (
    <>
      <PageHeader
        title="Models"
        subtitle="Each training run registers its best checkpoint as a candidate; numbers are from its latest verification"
        extra={
          <Space>
            <Typography.Text type="secondary">
              {selected.length ? `${selected.length} selected` : 'Select two to compare'}
            </Typography.Text>
            <Button type="primary" disabled={selected.length < 2 || !testPhotos} onClick={compare}>
              Compare on the verify set
            </Button>
          </Space>
        }
      />
      <PageBody>
        <Row gutter={[16, 16]}>
          {progress.length > 1 ? (
            <Col span={24}>
              <Card size="small" title="Accuracy by model">
                <ProgressChart models={progress} />
              </Card>
            </Col>
          ) : null}
          <Col span={24}>
            <Card size="small">
              <Table
                size="small"
                rowKey="id"
                dataSource={models}
                pagination={false}
                scroll={{ x: 960 }}
                rowSelection={{
                  selectedRowKeys: selected,
                  onChange: (keys) => setSelected((keys as number[]).slice(-4)),
                }}
                locale={{ emptyText: 'No models yet: a finished training run adds one.' }}
                columns={[
                  { title: 'Model', render: (_, m) => <b>{m.name}</b> },
                  { title: 'Status', render: (_, m) => STATUS[m.status] },
                  {
                    title: 'From',
                    render: (_, m) => <Link href={`/runs/${m.runId}`}>Run #{m.runId}</Link>,
                  },
                  {
                    title: `Visit (bar ${BAR.visit * 100})`,
                    render: (_, m) => <Score v={m.visitCorrect} bar={BAR.visit} />,
                  },
                  {
                    title: `Segment (bar ${BAR.dart * 100})`,
                    render: (_, m) => <Score v={m.dartCorrect} bar={BAR.dart} />,
                  },
                  {
                    title: `Board (bar ${BAR.board * 100})`,
                    render: (_, m) => <Score v={m.boardFound} bar={BAR.board} />,
                  },
                  {
                    title: 'Verified on',
                    render: (_, m) =>
                      m.evaluatedOn
                        ? `${m.evaluatedOn}${m.samples != null ? ` · ${m.samples} photos` : ''}`
                        : '—',
                  },
                  {
                    title: 'Core ML',
                    render: (_, m) =>
                      m.mlpackage ? (
                        <Tag color="success">exported</Tag>
                      ) : (
                        <Typography.Text type="warning">export failed</Typography.Text>
                      ),
                  },
                  {
                    render: (_, m) => (
                      <Flex gap={6} justify="end">
                        <Button size="small" disabled={!testPhotos} onClick={() => start([m.id])}>
                          Verify
                        </Button>
                        <Dropdown
                          menu={{
                            items: [
                              {
                                key: 'mlpackage',
                                disabled: !m.mlpackage,
                                label: (
                                  <a href={`/api/models/${m.id}/download`} download>
                                    Core ML package (.zip)
                                  </a>
                                ),
                              },
                              {
                                key: 'checkpoint',
                                label: (
                                  <a href={`/api/models/${m.id}/download?file=checkpoint`} download>
                                    PyTorch checkpoint (.pt)
                                  </a>
                                ),
                              },
                            ],
                          }}
                        >
                          <Button size="small" icon={<DownloadOutlined />} aria-label="Download" />
                        </Dropdown>
                        {m.status === 'active' ? null : (
                          <Button size="small" onClick={() => activate(m.id)}>
                            Set active
                          </Button>
                        )}
                      </Flex>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
          <Col span={24}>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              To ship one in Ton Up: unzip its Core ML package into{' '}
              <Typography.Text code>modules/dart-vision/ios/Models</Typography.Text> and build
              (docs/plan/capture-lab.md › Shipping a model). The verify set grows as you label, so
              compare models in one verification rather than by their old numbers.
            </Typography.Paragraph>
          </Col>
        </Row>
      </PageBody>
    </>
  );
}
