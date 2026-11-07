'use client';

import { App, Empty, Flex, InputNumber, Progress, Segmented, Tag, Typography } from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { ReadsMode, ReadsOverview } from '~/lib/reads';

import { Count, CountStrip, Panel, Panels, Section } from './Page';
import { legendOrder, useChartTheme } from './RunCharts';
import { MODEL_COLORS } from './VerifyCharts';

const tooltipStyle = { borderRadius: 6, fontSize: 12 };
/** Entered by hand is the background: grey; reads blue, fixed orange, blind checks purple. */
const COLORS = {
  entered: '#bfbfbf',
  confirmed: MODEL_COLORS[0],
  fixed: MODEL_COLORS[1],
  blind: '#722ed1',
};
const AGREE_BAR = 0.95;

const weekLabel = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Overview › Model reads (capture-lab.md › Model reads): whether the phone reads training visits
 * and the rules for it, then how reads have gone: confirmed or fixed, blind checks agreeing, time
 * saved, and what gets fixed.
 */
export function ReadsSection({ reads }: { reads: ReadsOverview }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { settings, status, agreement, totals, seconds, fixes, weeks } = reads;

  const put = async (change: { mode?: ReadsMode; every?: number }) => {
    setSaving(true);
    const res = await fetch('/api/settings/reads', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(change),
    });
    setSaving(false);
    if (!res.ok) return void message.error('Couldn’t change the setting');
    router.refresh();
  };

  const share = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—');
  return (
    <>
      <Section
        title={
          <Flex align="center" gap={8} wrap>
            Model reads
            {status.on ? (
              <Tag color="success">On · {status.model} reads training visits</Tag>
            ) : (
              <Tag>Off: {status.why}</Tag>
            )}
          </Flex>
        }
        extra={<Link href="/captures?labelled=read">Read-labelled captures</Link>}
      >
        <Flex wrap gap={24}>
          <div
            style={{
              flex: '1 1 380px',
              display: 'grid',
              gridTemplateColumns: 'minmax(130px, auto) minmax(0, 1fr)',
              gap: '12px 16px',
              alignItems: 'center',
            }}
          >
            <Typography.Text type="secondary">The phone reads</Typography.Text>
            <Segmented<ReadsMode>
              style={{ width: 'fit-content' }}
              value={settings.mode}
              disabled={saving}
              onChange={(mode) => void put({ mode })}
              options={[
                { value: 'off', label: 'Off' },
                { value: 'train', label: 'Training sessions' },
              ]}
            />
            <Typography.Text type="secondary">Only once</Typography.Text>
            <Typography.Text>
              the active model gets visits ≥ 90% on verify
              {status.model ? ` (${status.model} is active)` : ''}
            </Typography.Text>
            <Typography.Text type="secondary">Blind checks</Typography.Text>
            <Flex align="center" gap={8} wrap>
              1 visit in
              <InputNumber
                size="small"
                min={2}
                max={100}
                value={settings.every}
                disabled={saving}
                aria-label="Blind check every N visits"
                onChange={(v) => {
                  if (typeof v === 'number' && v !== settings.every) void put({ every: v });
                }}
                style={{ width: 64 }}
              />
              scored first, the read shown after
            </Flex>
            <Typography.Text type="secondary">Pause reads if</Typography.Text>
            <Typography.Text>
              blind checks agree on fewer than 95% of the last 50 (with at least 10)
            </Typography.Text>
          </div>
          <div
            style={{
              flex: '1 1 300px',
              padding: '12px 16px',
              borderRadius: 8,
              background: 'var(--ant-color-fill-quaternary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <Typography.Text strong>Never read</Typography.Text>
            <Typography.Text type="secondary">
              Val and verify sessions: their values are always entered first, so verification isn’t
              the model grading itself and val doesn’t lean toward it either.
            </Typography.Text>
            <Typography.Text type="secondary">
              The phone asks Lab for each session’s set when it starts, and reads only with the
              active model.
            </Typography.Text>
          </div>
        </Flex>
      </Section>

      <CountStrip>
        <Count title="Read by the model" value={totals.read} note="visits, all time" />
        <Count
          title="Confirmed as read"
          value={totals.confirmed}
          note={`${share(totals.confirmed, totals.read)} of reads`}
        />
        <Count
          title="Fixed"
          value={totals.fixed}
          note={<Link href="/captures?labelled=fixed">Fixed reads</Link>}
        />
        <Count
          title="Blind checks"
          value={totals.agreed}
          suffix={<span style={{ fontSize: 14 }}> of {totals.blind} agreed</span>}
          note={
            agreement.rate === null
              ? 'none yet'
              : `${Math.round(agreement.rate * 100)}% over the last ${agreement.checks}`
          }
        />
        <Count
          title="Seconds per visit"
          value={seconds.read ?? '—'}
          suffix={<span style={{ fontSize: 14 }}> read · {seconds.entered ?? '—'} by hand</span>}
          note="median"
        />
      </CountStrip>

      <Panels min={420}>
        <Panel title="How visits were labelled, per week">
          <ModesChart weeks={weeks} />
        </Panel>
        <Panel title="Blind checks: you and the model agree">
          <AgreeChart weeks={weeks} />
        </Panel>
        <Panel title="What gets fixed in a read">
          <FixesList fixes={fixes} />
        </Panel>
      </Panels>
    </>
  );
}

function ModesChart({ weeks }: { weeks: ReadsOverview['weeks'] }) {
  const { GRID, AXIS, CURSOR } = useChartTheme();
  if (!weeks.some((w) => w.entered + w.confirmed + w.fixed + w.blind)) {
    return <Empty description="No visits from the phone yet" />;
  }
  const data = weeks.map((w) => ({ ...w, label: weekLabel(w.week) }));
  const bar = (key: keyof typeof COLORS, name: string, top = false) => (
    <Bar
      name={name}
      dataKey={key}
      stackId="w"
      fill={COLORS[key]}
      radius={top ? [3, 3, 0, 0] : undefined}
      isAnimationActive={false}
    />
  );
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} width={40} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: CURSOR }}
          labelFormatter={(l) => `Week of ${l}`}
        />
        <Legend
          align="right"
          wrapperStyle={{ fontSize: 12 }}
          itemSorter={legendOrder(['entered', 'confirmed', 'fixed', 'blind'])}
        />
        {bar('entered', 'Entered by hand')}
        {bar('confirmed', 'Read, confirmed')}
        {bar('fixed', 'Read, fixed')}
        {bar('blind', 'Blind check', true)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function AgreeChart({ weeks }: { weeks: ReadsOverview['weeks'] }) {
  const { GRID, AXIS } = useChartTheme();
  const data = weeks.map((w) => ({
    label: weekLabel(w.week),
    rate: w.blind ? w.agreed / w.blind : null,
    blind: w.blind,
  }));
  if (!data.some((d) => d.rate !== null)) return <Empty description="No blind checks yet" />;
  const lo = Math.min(0.9, ...data.flatMap((d) => (d.rate === null ? [] : [d.rate])));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} />
        <YAxis
          domain={[Math.floor(lo * 20) / 20, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fill: AXIS, fontSize: 12 }}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l) => `Week of ${l}`}
          formatter={(v, _n, p) => [
            `${Math.round(Number(v) * 100)}% of ${(p.payload as { blind: number }).blind}`,
            'Agreed',
          ]}
        />
        <ReferenceLine
          y={AGREE_BAR}
          stroke={AXIS}
          strokeDasharray="5 4"
          label={{
            value: 'pause below 95%',
            position: 'insideBottomLeft',
            fill: AXIS,
            fontSize: 11,
          }}
        />
        <Line
          dataKey="rate"
          stroke={COLORS.blind}
          strokeWidth={2}
          connectNulls
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FixesList({ fixes }: { fixes: ReadsOverview['fixes'] }) {
  const rows: [string, number][] = [
    ['Value changed', fixes.valuesChanged],
    ['Tip moved more than 3 mm', fixes.tipsMoved],
    ['Marked on the wire', fixes.wiresMarked],
    ['Dart added (the model missed one)', fixes.dartsAdded],
    ['Dart removed (not a dart)', fixes.dartsRemoved],
    ['Board re-marked', fixes.boardRemarked],
  ];
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (!rows.some(([, n]) => n)) return <Empty description="No fixed reads yet" />;
  return (
    <Flex vertical gap={8}>
      {rows.map(([label, n]) => (
        <div
          key={label}
          style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 32px', columnGap: 12 }}
        >
          <Typography.Text>{label}</Typography.Text>
          <Typography.Text style={{ textAlign: 'right' }}>{n}</Typography.Text>
          <Progress
            percent={(n / max) * 100}
            showInfo={false}
            size="small"
            strokeColor={COLORS.fixed}
            style={{ gridColumn: '1 / -1', margin: 0 }}
          />
        </div>
      ))}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Values changed are what matter for trusting reads: each is a visit the model would have
        scored wrong.
      </Typography.Text>
    </Flex>
  );
}
