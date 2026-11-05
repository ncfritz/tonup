'use client';

import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { App, Button, Collapse, Empty, Flex, Progress, Segmented, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { RunSummary } from '~/lib/runs';
import type { ResultRow, Verification } from '~/lib/verify';

import { Count, CountStrip, pageStyles, Panel, Panels, Section } from './Page';
import { PageBody, PageHeader } from './PageHeader';
import { pct, RunStatus } from './RunBits';
import { BAR } from './RunCharts';
import { BreakdownChart, MEASURES, MODEL_COLORS, type Measure } from './VerifyCharts';
import { PREDICTED, TRUTH, WorstPhoto } from './WorstPhoto';

const FIELD: Record<Measure, 'visitCorrect' | 'dartCorrect' | 'boardFound'> = {
  visit: 'visitCorrect',
  dart: 'dartCorrect',
  board: 'boardFound',
};

function Delta({ v, base }: { v: number; base: number }) {
  const d = (v - base) * 100;
  if (Math.abs(d) < 0.05) return <Typography.Text type="secondary">±0</Typography.Text>;
  return (
    <Typography.Text type={d > 0 ? 'success' : 'danger'} style={{ fontSize: 13 }}>
      {d > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(d).toFixed(1)} pts
    </Typography.Text>
  );
}

function ResultPanel({ r, color, base }: { r: ResultRow; color: string; base: ResultRow | null }) {
  return (
    <Panel
      flush
      title={
        <Flex gap={8} align="center">
          <span style={{ width: 10, height: 10, borderRadius: 5, background: color }} />
          {r.model}
          {r.modelStatus === 'active' ? <Tag color="cyan">Active</Tag> : null}
        </Flex>
      }
      extra={
        <Typography.Text type="secondary">
          {r.samples} photos{r.valuesOnly ? ` · ${r.valuesOnly} values only` : ''}
        </Typography.Text>
      }
    >
      <CountStrip>
        {MEASURES.map((m) => {
          const v = r[FIELD[m.key]];
          return (
            <Count
              key={m.key}
              title={m.label}
              value={pct(v)}
              note={
                <Flex gap={6} align="center" wrap>
                  {v >= BAR[m.key] ? (
                    <Tag color="success">meets {BAR[m.key] * 100}%</Tag>
                  ) : (
                    <Tag color="warning">bar {BAR[m.key] * 100}%</Tag>
                  )}
                  {base ? <Delta v={v} base={base[FIELD[m.key]]} /> : null}
                </Flex>
              }
            />
          );
        })}
      </CountStrip>
    </Panel>
  );
}

interface LiveData {
  run: RunSummary;
  log: { tail: string };
}

/** One verification: totals against the bar, the breakdown by condition, the worst photos. */
export function VerifyView({ data, initialLog }: { data: Verification; initialLog: string }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [live, setLive] = useState<LiveData>({ run: data.run, log: { tail: initialLog } });
  const running = live.run.status === 'queued' || live.run.status === 'running';
  const [measure, setMeasure] = useState<Measure>('visit');
  const [only, setOnly] = useState('all');

  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/runs/${data.run.id}`);
      if (!res.ok) return;
      const next = (await res.json()) as LiveData;
      setLive(next);
      if (next.run.status !== 'queued' && next.run.status !== 'running') router.refresh();
    }, 2000);
    return () => clearInterval(t);
  }, [running, data.run.id, router]);

  const run = live.run;
  const models =
    data.results.length > 0
      ? data.results.map((r) => ({ id: r.modelId, name: r.model }))
      : run.kind === 'verify'
        ? run.params.modelIds.map((id, i) => ({ id, name: run.models[i] ?? `#${id}` }))
        : [];
  const colorOf = (id: number) =>
    MODEL_COLORS[
      Math.max(
        0,
        models.findIndex((m) => m.id === id),
      ) % MODEL_COLORS.length
    ]!;
  const done = data.results.length;
  const asked = run.kind === 'verify' ? run.params.modelIds.length : 1;
  const worst = data.worst.filter((w) => only === 'all' || String(w.modelId) === only);

  const cancel = async () => {
    const res = await fetch(`/api/runs/${run.id}/cancel`, { method: 'POST' });
    if (!res.ok) message.error('Couldn’t cancel');
  };

  return (
    <>
      <PageHeader
        title={
          <Flex gap={10} align="center">
            {run.kind === 'verify' ? `Verification #${run.id}` : `Training run #${run.id}’s check`}
            <RunStatus run={run} />
          </Flex>
        }
        subtitle={[
          models.map((m) => m.name).join(' vs '),
          data.snapshot
            ? `snapshot ${data.snapshot.id}, ${data.snapshot.test} verify photos`
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        extra={
          running ? (
            <Button danger onClick={cancel}>
              Cancel
            </Button>
          ) : run.kind === 'train' ? (
            <Link href={`/runs/${run.id}`}>Training run #{run.id}</Link>
          ) : null
        }
      />
      <PageBody>
        {running || run.error ? (
          <Section>
            {running ? (
              <>
                <Typography.Text type="secondary">
                  {run.status === 'queued'
                    ? 'Waiting for the run ahead of it'
                    : run.stage === 'snapshot'
                      ? 'Snapshotting the verify set'
                      : `Verifying model ${Math.min(done + 1, asked)} of ${asked}`}
                </Typography.Text>
                <Progress percent={Math.round((done / asked) * 100)} status="active" />
              </>
            ) : null}
            {run.error ? <Typography.Text type="danger">{run.error}</Typography.Text> : null}
          </Section>
        ) : null}

        {data.results.length ? (
          <>
            <Panels min={520}>
              {data.results.map((r, i) => (
                <ResultPanel
                  key={r.modelId}
                  r={r}
                  color={colorOf(r.modelId)}
                  base={i > 0 ? data.results[0]! : null}
                />
              ))}
            </Panels>

            <Section
              title="By condition"
              extra={
                <Segmented
                  value={measure}
                  onChange={(v) => setMeasure(v as Measure)}
                  options={MEASURES.map((m) => ({ value: m.key, label: m.label }))}
                />
              }
              flush
            >
              <Panels min={420} edge={false}>
                {data.breakdown.map((b) => (
                  <Panel
                    key={b.key}
                    title={b.title}
                    extra={
                      b.unmeasured ? (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {b.unmeasured} not measured
                        </Typography.Text>
                      ) : null
                    }
                  >
                    <BreakdownChart breakdown={b} models={models} measure={measure} />
                  </Panel>
                ))}
              </Panels>
            </Section>

            <Section
              title="Worst photos"
              extra={
                models.length > 1 ? (
                  <Segmented
                    value={only}
                    onChange={setOnly}
                    options={[
                      { value: 'all', label: 'All models' },
                      ...models.map((m) => ({ value: String(m.id), label: m.name })),
                    ]}
                  />
                ) : null
              }
              flush
            >
              <div className={pageStyles.legend}>
                <Typography.Text type="secondary">
                  <span style={{ color: TRUTH }}>○</span> true tips
                </Typography.Text>
                <Typography.Text type="secondary">
                  <span style={{ color: PREDICTED }}>✕</span> predicted tips and the board the model
                  found
                </Typography.Text>
                <Typography.Text type="secondary">
                  Board not found first, then most darts wrong
                </Typography.Text>
              </div>
              {worst.length ? (
                <div className={`${pageStyles.tiles} ${pageStyles.tilesInSection}`}>
                  {worst.map((w) => (
                    <WorstPhoto
                      key={`${w.modelId}-${w.captureId}`}
                      item={w}
                      color={models.length > 1 ? colorOf(w.modelId) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <div className={pageStyles.empty}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Every visit right" />
                </div>
              )}
            </Section>
          </>
        ) : null}

        <Section>
          <Collapse
            ghost
            size="small"
            defaultActiveKey={running || run.error ? ['log'] : []}
            items={[
              {
                key: 'log',
                label: 'Log',
                children: <pre className={pageStyles.log}>{live.log.tail || 'Nothing yet.'}</pre>,
              },
            ]}
          />
        </Section>
      </PageBody>
    </>
  );
}
