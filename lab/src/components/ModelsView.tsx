'use client';

import { App, Button, Card, Table, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { pct } from './RunBits';
import { BAR } from './RunCharts';
import { PageBody, PageHeader } from './PageHeader';

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

/** The models runs have produced. Comparing them on one verify snapshot arrives in L4. */
export function ModelsView({ models }: { models: ModelListItem[] }) {
  const { message } = App.useApp();
  const router = useRouter();
  const activate = async (id: number) => {
    const res = await fetch(`/api/models/${id}/activate`, { method: 'POST' });
    if (!res.ok) return message.error('Couldn’t set it active');
    message.success('Capture will pre-fill with this model');
    router.refresh();
  };
  return (
    <>
      <PageHeader
        title="Models"
        subtitle="Each training run registers its best checkpoint as a candidate"
      />
      <PageBody>
        <Card size="small">
          <Table
            size="small"
            rowKey="id"
            dataSource={models}
            pagination={false}
            scroll={{ x: 820 }}
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
                    ? `${m.evaluatedOn}${m.samples != null ? ` · ${m.samples}` : ''}`
                    : '—',
              },
              {
                title: 'Core ML',
                render: (_, m) =>
                  m.mlpackage ? (
                    <Typography.Text code>{m.mlpackage}</Typography.Text>
                  ) : (
                    <Typography.Text type="warning">export failed</Typography.Text>
                  ),
              },
              {
                render: (_, m) =>
                  m.status === 'active' ? null : (
                    <Button size="small" onClick={() => activate(m.id)}>
                      Set active
                    </Button>
                  ),
              },
            ]}
          />
        </Card>
      </PageBody>
    </>
  );
}
