'use client';

import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Flex,
  Progress,
  Row,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { EpochMetrics, RunSummary } from '~/lib/runs';

import { PageBody, PageHeader } from './PageHeader';
import { describeRun, duration, pct, RunStatus } from './RunBits';
import { AccuracyChart, BAR, LossChart } from './RunCharts';

interface RunData {
  run: RunSummary;
  metrics: EpochMetrics[];
  log: { tail: string; step: { epoch: number; step: number; of: number } | null };
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** One run, live while it runs: progress, the accuracy and loss charts, the log and results. */
export function RunView({ initial }: { initial: RunData }) {
  const { message } = App.useApp();
  const [data, setData] = useState(initial);
  const { run, metrics, log } = data;
  const live = run.status === 'queued' || run.status === 'running';
  const now = useNow(live);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!live) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${run.id}`);
      if (res.ok) setData((await res.json()) as RunData);
    }, 2000);
    return () => clearInterval(t);
  }, [live, run.id]);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log.tail]);

  const epochs = run.params.epochs;
  const done = metrics.length;
  const stepPart =
    run.stage === 'train' && log.step && log.step.epoch === done + 1
      ? log.step.step / log.step.of
      : 0;
  const progress =
    run.status === 'done' ? 1 : run.stage === 'train' ? (done + stepPart) / epochs : done / epochs;
  const perEpoch = done ? metrics.reduce((s, m) => s + m.seconds, 0) / done : null;
  const left =
    perEpoch && run.stage === 'train' ? perEpoch * (epochs - done - stepPart) * 1000 : null;
  const best = metrics.reduce<EpochMetrics | null>(
    (b, m) => (!b || m.visit_correct > b.visit_correct ? m : b),
    null,
  );
  const last = metrics[metrics.length - 1];

  const cancel = async () => {
    const res = await fetch(`/api/runs/${run.id}/cancel`, { method: 'POST' });
    if (!res.ok) message.error('Couldn’t cancel');
  };

  const passTag = (v: number | null, bar: number) =>
    v == null ? null : v >= bar ? (
      <Tag color="success">meets {Math.round(bar * 100)}%</Tag>
    ) : (
      <Tag color="warning">bar {Math.round(bar * 100)}%</Tag>
    );

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link href="/runs">Runs</Link> / #{run.id}
          </>
        }
        title={
          <Flex gap={10} align="center">
            Run #{run.id} <RunStatus run={run} />
          </Flex>
        }
        subtitle={`${describeRun(run)}${run.snapshot ? ` · snapshot: ${run.snapshot.train} train, ${run.snapshot.val} val, ${run.snapshot.test} verify` : ''}`}
        extra={
          live ? (
            <Button danger onClick={cancel}>
              Cancel run
            </Button>
          ) : null
        }
      />
      <PageBody>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card size="small">
              <Flex vertical gap={12}>
                <div>
                  <Typography.Text type="secondary">
                    {run.status === 'queued'
                      ? 'Waiting for the run ahead of it'
                      : `Epoch ${Math.min(done + (run.stage === 'train' ? 1 : 0), epochs)} of ${epochs}${
                          run.stage === 'train' && log.step
                            ? ` · step ${log.step.step}/${log.step.of}`
                            : ''
                        }`}
                  </Typography.Text>
                  <Progress
                    percent={Math.round(progress * 100)}
                    status={run.status === 'failed' ? 'exception' : live ? 'active' : undefined}
                    strokeColor="#0F766E"
                  />
                </div>
                <Row gutter={16}>
                  <Col xs={12} md={5}>
                    <Statistic
                      title="Elapsed"
                      value={run.startedAt ? duration((run.endedAt ?? now) - run.startedAt) : '—'}
                    />
                  </Col>
                  <Col xs={12} md={5}>
                    <Statistic
                      title="Left (estimate)"
                      value={left != null ? `~${duration(left)}` : '—'}
                    />
                  </Col>
                  <Col xs={12} md={5}>
                    <Statistic
                      title="Per epoch"
                      value={perEpoch != null ? duration(perEpoch * 1000) : '—'}
                    />
                  </Col>
                  <Col xs={12} md={4}>
                    <Statistic
                      title="Throughput"
                      value={
                        last?.images_per_second
                          ? `${Math.round(last.images_per_second)} img/s`
                          : '—'
                      }
                    />
                  </Col>
                  <Col xs={24} md={5}>
                    <Statistic
                      title="Best val visit"
                      value={best ? pct(best.visit_correct) : '—'}
                      suffix={
                        best ? (
                          <Typography.Text type="secondary"> ep {best.epoch}</Typography.Text>
                        ) : null
                      }
                    />
                  </Col>
                </Row>
              </Flex>
            </Card>
          </Col>

          {run.error ? (
            <Col span={24}>
              <Card size="small">
                <Typography.Text type="danger">{run.error}</Typography.Text>
              </Card>
            </Col>
          ) : null}

          {run.status === 'done' || run.visitCorrect != null ? (
            <Col span={24}>
              <Card
                size="small"
                title={`Verified on ${run.evaluatedOn ?? '—'}${run.samples != null ? ` · ${run.samples} photos` : ''}`}
                extra={run.model ? <Link href="/models">Model {run.model}</Link> : null}
              >
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Statistic title="Visit total correct" value={pct(run.visitCorrect)} />
                    {passTag(run.visitCorrect, BAR.visit)}
                  </Col>
                  <Col xs={24} md={8}>
                    <Statistic title="Dart segment correct" value={pct(run.dartCorrect)} />
                    {passTag(run.dartCorrect, BAR.dart)}
                  </Col>
                  <Col xs={24} md={8}>
                    <Statistic title="Board found" value={pct(run.boardFound)} />
                    {passTag(run.boardFound, BAR.board)}
                  </Col>
                </Row>
              </Card>
            </Col>
          ) : null}

          <Col xs={24} lg={12}>
            <Card size="small" title="Validation accuracy by epoch">
              <AccuracyChart metrics={metrics} epochs={epochs} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="Loss by epoch">
              <LossChart metrics={metrics} epochs={epochs} />
            </Card>
          </Col>

          <Col xs={24} lg={9}>
            <Card size="small" title="Settings">
              <Descriptions
                size="small"
                column={1}
                items={[
                  {
                    label: 'Start from',
                    children: run.params.from === 'model' ? (run.baseModel ?? '—') : 'Scratch',
                  },
                  {
                    label: 'Data',
                    children: [
                      run.params.deepdarts ? 'DeepDarts' : null,
                      run.params.captures ? 'our captures' : null,
                    ]
                      .filter(Boolean)
                      .join(' + '),
                  },
                  { label: 'Epochs', children: run.params.epochs },
                  { label: 'Learning rate', children: run.params.lr },
                  { label: 'Batch', children: run.params.batch },
                  { label: 'Capture weight', children: `${run.params.captureWeight}×` },
                  {
                    label: 'DeepDarts per epoch',
                    children: run.params.deepdartsSample
                      ? run.params.deepdartsSample.toLocaleString()
                      : 'all',
                  },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={15}>
            <Card
              size="small"
              title="Log"
              extra={<Typography.Text type="secondary">runs/{run.id}/log.txt</Typography.Text>}
            >
              <pre
                ref={logRef}
                style={{
                  margin: 0,
                  background: '#0E1217',
                  color: '#c9d1d9',
                  borderRadius: 6,
                  padding: '12px 14px',
                  fontSize: 12,
                  lineHeight: 1.6,
                  maxHeight: 360,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {log.tail || 'Nothing yet.'}
              </pre>
            </Card>
          </Col>
        </Row>
      </PageBody>
    </>
  );
}
