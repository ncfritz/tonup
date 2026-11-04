'use client';

import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Drawer,
  Flex,
  Form,
  InputNumber,
  Radio,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { RunSummary, TrainParams } from '~/lib/runs';

import { PageBody, PageHeader } from './PageHeader';
import { describeRun, duration, pct, RunStatus } from './RunBits';

type Defaults = Record<'scratch' | 'model', Omit<TrainParams, 'from' | 'baseModelId'>>;

/** Runs: the queue and history, and starting a training run. */
export function RunsView({
  runs,
  models,
  defaults,
  hasDeepdarts,
  counts,
}: {
  runs: RunSummary[];
  models: { id: number; name: string; status: string }[];
  defaults: Defaults;
  hasDeepdarts: boolean;
  counts: { train: number; val: number; test: number };
}) {
  const { message } = App.useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<TrainParams>();
  const from = Form.useWatch('from', form) ?? 'scratch';

  // Keep the list fresh while something is queued or running.
  const live = runs.some((r) => r.status === 'queued' || r.status === 'running');
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [live, router]);

  const openForm = (kind: 'scratch' | 'model') => {
    const active = models.find((m) => m.status === 'active') ?? models[0];
    form.setFieldsValue({
      from: kind,
      baseModelId: kind === 'model' ? active?.id : undefined,
      ...defaults[kind],
      deepdarts: hasDeepdarts && defaults[kind].deepdarts,
    });
    setOpen(true);
  };

  const submit = async (values: TrainParams) => {
    setSaving(true);
    const res = await fetch('/api/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    setSaving(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) return message.error(body?.error ?? 'Couldn’t start the run');
    setOpen(false);
    router.push(`/runs/${body.id}`);
  };

  return (
    <>
      <PageHeader
        title="Runs"
        subtitle="One at a time, on this Mac’s GPU"
        extra={
          <Space wrap>
            <Button onClick={() => openForm('model')} disabled={!models.length}>
              Fine-tune a model
            </Button>
            <Button type="primary" onClick={() => openForm('scratch')}>
              New training run
            </Button>
          </Space>
        }
      />
      <PageBody>
        <Card size="small">
          <Table
            size="small"
            rowKey="id"
            dataSource={runs}
            pagination={{ pageSize: 20, hideOnSinglePage: true }}
            scroll={{ x: 760 }}
            locale={{ emptyText: 'No runs yet. Start with a baseline on DeepDarts.' }}
            columns={[
              {
                title: 'Run',
                render: (_, r) => <Link href={`/runs/${r.id}`}>#{r.id}</Link>,
                width: 64,
              },
              { title: 'What', render: (_, r) => describeRun(r) },
              { title: 'Status', render: (_, r) => <RunStatus run={r} /> },
              {
                title: 'Visit correct',
                render: (_, r) =>
                  r.visitCorrect == null ? (
                    '—'
                  ) : (
                    <span title={r.evaluatedOn ?? undefined}>{pct(r.visitCorrect)}</span>
                  ),
              },
              {
                title: 'Model',
                render: (_, r) => (r.model ? <Link href="/models">{r.model}</Link> : '—'),
              },
              {
                title: 'Time',
                render: (_, r) =>
                  r.startedAt ? duration((r.endedAt ?? Date.now()) - r.startedAt) : 'waiting',
              },
            ]}
          />
        </Card>
      </PageBody>

      <Drawer
        title={from === 'model' ? 'Fine-tune a model' : 'New training run'}
        open={open}
        onClose={() => setOpen(false)}
        size={480}
        extra={
          <Button type="primary" loading={saving} onClick={() => form.submit()}>
            Start
          </Button>
        }
      >
        <Form form={form} layout="vertical" onFinish={submit} requiredMark={false}>
          <Form.Item name="from" label="Start from">
            <Radio.Group
              onChange={(e) => openForm(e.target.value)}
              options={[
                { value: 'scratch', label: 'Scratch (ImageNet backbone)' },
                { value: 'model', label: 'A model', disabled: !models.length },
              ]}
            />
          </Form.Item>
          {from === 'model' ? (
            <Form.Item name="baseModelId" label="Model to fine-tune" rules={[{ required: true }]}>
              <Select
                options={models.map((m) => ({ value: m.id, label: `${m.name} (${m.status})` }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item label="Data">
            <Flex vertical gap={4}>
              <Form.Item name="deepdarts" valuePropName="checked" noStyle>
                <Checkbox disabled={!hasDeepdarts}>
                  DeepDarts{hasDeepdarts ? '' : ' (set its folder on Sessions)'}
                </Checkbox>
              </Form.Item>
              <Form.Item name="captures" valuePropName="checked" noStyle>
                <Checkbox>
                  Our captures: {counts.train} train, {counts.val} val ({counts.test} kept for
                  verification)
                </Checkbox>
              </Form.Item>
            </Flex>
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item name="epochs" label="Epochs" rules={[{ required: true }]}>
              <InputNumber min={1} max={500} />
            </Form.Item>
            <Form.Item name="lr" label="Learning rate" rules={[{ required: true }]}>
              <InputNumber min={0.00001} max={0.1} step={0.0001} />
            </Form.Item>
            <Form.Item name="batch" label="Batch" rules={[{ required: true }]}>
              <InputNumber min={1} max={128} />
            </Form.Item>
          </Flex>
          <Flex gap={12} wrap>
            <Form.Item
              name="captureWeight"
              label="Capture weight"
              tooltip="Each of our photos counts this many times per epoch"
            >
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Form.Item
              name="deepdartsSample"
              label="DeepDarts per epoch"
              tooltip="0 uses all of them; a sample keeps fine-tunes from drowning our photos"
            >
              <InputNumber min={0} max={100000} step={500} />
            </Form.Item>
            <Form.Item name="workers" label="Loader workers">
              <InputNumber min={0} max={16} />
            </Form.Item>
          </Flex>
          <Alert
            type="info"
            showIcon
            title="What happens"
            description="Lab snapshots the current labels, trains, verifies the best checkpoint on the verify set (DeepDarts’ test split until there is one), exports it to Core ML and registers it as a candidate model."
          />
          <Typography.Paragraph type="secondary" style={{ marginTop: 12 }}>
            Time a short run first on a new machine (Epochs 1) to see how long an epoch takes.
          </Typography.Paragraph>
        </Form>
      </Drawer>
    </>
  );
}
