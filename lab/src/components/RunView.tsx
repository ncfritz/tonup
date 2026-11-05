'use client';

import { App, Button, Descriptions, Flex, Progress, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { EpochMetrics, TrainRunSummary } from '~/lib/runs';

import { Count, CountStrip, pageStyles, Panel, Panels, Section } from './Page';
import { PageBody, PageHeader } from './PageHeader';
import { describeRun, duration, pct, RunStatus } from './RunBits';
import { AccuracyChart, BAR, LossChart } from './RunCharts';

interface RunData {
  run: TrainRunSummary;
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
        <Section>
          <Typography.Text type="secondary">
            {run.status === 'queued'
              ? 'Waiting for the run ahead of it'
              : `Epoch ${Math.min(done + (run.stage === 'train' ? 1 : 0), epochs)} of ${epochs}${
                  run.stage === 'train' && log.step ? ` · step ${log.step.step}/${log.step.of}` : ''
                }`}
          </Typography.Text>
          <Progress
            percent={Math.round(progress * 100)}
            status={run.status === 'failed' ? 'exception' : live ? 'active' : undefined}
          />
          {run.error ? <Typography.Text type="danger">{run.error}</Typography.Text> : null}
        </Section>
        <CountStrip>
          <Count
            title="Elapsed"
            value={run.startedAt ? duration((run.endedAt ?? now) - run.startedAt) : '—'}
          />
          <Count title="Left (estimate)" value={left != null ? `~${duration(left)}` : '—'} />
          <Count title="Per epoch" value={perEpoch != null ? duration(perEpoch * 1000) : '—'} />
          <Count
            title="Throughput"
            value={last?.images_per_second ? `${Math.round(last.images_per_second)} img/s` : '—'}
          />
          <Count
            title="Best val visit"
            value={best ? pct(best.visit_correct) : '—'}
            note={best ? `epoch ${best.epoch}` : undefined}
          />
        </CountStrip>

        {run.status === 'done' || run.visitCorrect != null ? (
          <Section
            title={`Verified on ${run.evaluatedOn ?? '—'}${run.samples != null ? ` · ${run.samples} photos` : ''}`}
            extra={run.model ? <Link href="/models">Model {run.model}</Link> : null}
            flush
          >
            <CountStrip>
              <Count
                title="Visit total correct"
                value={pct(run.visitCorrect)}
                note={passTag(run.visitCorrect, BAR.visit)}
              />
              <Count
                title="Dart segment correct"
                value={pct(run.dartCorrect)}
                note={passTag(run.dartCorrect, BAR.dart)}
              />
              <Count
                title="Board found"
                value={pct(run.boardFound)}
                note={passTag(run.boardFound, BAR.board)}
              />
            </CountStrip>
          </Section>
        ) : null}

        <Panels min={480}>
          <Panel title="Validation accuracy by epoch">
            <AccuracyChart metrics={metrics} epochs={epochs} />
          </Panel>
          <Panel title="Loss by epoch">
            <LossChart metrics={metrics} epochs={epochs} />
          </Panel>
        </Panels>

        <Panels min={360}>
          <Panel title="Settings">
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
          </Panel>
          <Panel
            title="Log"
            extra={<Typography.Text type="secondary">runs/{run.id}/log.txt</Typography.Text>}
          >
            <pre ref={logRef} className={pageStyles.log}>
              {log.tail || 'Nothing yet.'}
            </pre>
          </Panel>
        </Panels>
      </PageBody>
    </>
  );
}
