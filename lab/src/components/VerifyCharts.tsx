'use client';

import { WarningOutlined } from '@ant-design/icons';
import { Empty, Flex, Typography } from 'antd';
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

import type { Breakdown, Coverage, ModelProgress } from '~/lib/verify';

import { BAR, SERIES } from './RunCharts';

const GRID = '#f0f0f0';
const AXIS = '#595959';
const WARN = '#ad6800';
const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Models in a comparison take the categorical slots in the order they're listed. */
export const MODEL_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

export type Measure = 'visit' | 'dart' | 'board';
export const MEASURES: { key: Measure; label: string }[] = [
  { key: 'visit', label: 'Visit total' },
  { key: 'dart', label: 'Dart segment' },
  { key: 'board', label: 'Board found' },
];

const tooltipStyle = { borderRadius: 6, fontSize: 12 };

/** One condition: a column per bucket and model, against the bar for the measure. */
export function BreakdownChart({
  breakdown,
  models,
  measure,
}: {
  breakdown: Breakdown;
  models: { id: number; name: string }[];
  measure: Measure;
}) {
  if (!breakdown.buckets.length) return <Empty description="Not measured on these photos" />;
  const data = breakdown.buckets.map((b) => {
    const row: Record<string, number | string> = { bucket: b.bucket };
    const ns = new Set<number>();
    for (const m of models) {
      const s = b.by[m.id];
      if (s) {
        row[`m${m.id}`] = s[measure];
        ns.add(s.n);
      }
    }
    row.n = Math.max(...ns);
    row.label = `${b.bucket}\nn=${row.n}`;
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={({ x, y, payload }) => {
            const row = data.find((d) => d.bucket === payload.value);
            return (
              <g transform={`translate(${x},${y})`}>
                <text y={12} textAnchor="middle" fill={AXIS} fontSize={11}>
                  {payload.value}
                </text>
                <text y={26} textAnchor="middle" fill="#8c8c8c" fontSize={10}>
                  n={row?.n}
                </text>
              </g>
            );
          }}
          height={34}
          interval={0}
          tickLine={false}
        />
        <YAxis domain={[0, 1]} tickFormatter={pct} tick={{ fill: AXIS, fontSize: 11 }} width={40} />
        <Tooltip
          formatter={(v, name) => [pct(Number(v)), name]}
          contentStyle={tooltipStyle}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        {models.length > 1 ? <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} /> : null}
        <ReferenceLine y={BAR[measure]} stroke={AXIS} strokeDasharray="5 4" />
        {models.map((m, i) => (
          <Bar
            key={m.id}
            name={m.name}
            dataKey={`m${m.id}`}
            fill={MODEL_COLORS[i % MODEL_COLORS.length]}
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Photos per bucket of one condition, training (train and val) and verify stacked. */
export function CoverageChart({ coverage }: { coverage: Coverage }) {
  const total = coverage.buckets.reduce((s, b) => s + b.training + b.verify, 0);
  if (!total) return <Empty description="No labelled photos yet" />;
  const thin = new Set(coverage.buckets.filter((b) => b.thin).map((b) => b.bucket));
  return (
    <ResponsiveContainer width="100%" height={36 * coverage.buckets.length + 40}>
      <BarChart
        data={coverage.buckets}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: AXIS, fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="bucket"
          width={118}
          tickLine={false}
          tick={({ x, y, payload }) => (
            <g transform={`translate(${x},${y})`}>
              <text
                x={-4}
                dy={4}
                textAnchor="end"
                fontSize={11}
                fill={thin.has(payload.value) ? WARN : AXIS}
                fontWeight={thin.has(payload.value) ? 600 : 400}
              >
                {thin.has(payload.value) ? '⚠ ' : ''}
                {payload.value}
              </text>
            </g>
          )}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          formatter={(v, name) => [v, name]}
          labelFormatter={(b) => (thin.has(String(b)) ? `${b} (thin)` : String(b))}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        <Bar
          name="Training (train + val)"
          dataKey="training"
          stackId="a"
          fill={SERIES.visit}
          stroke="#fff"
          strokeWidth={2}
          maxBarSize={20}
          isAnimationActive={false}
        />
        <Bar
          name="Verify"
          dataKey="verify"
          stackId="a"
          fill={SERIES.dart}
          stroke="#fff"
          strokeWidth={2}
          maxBarSize={20}
          radius={[0, 4, 4, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ThinNote() {
  return (
    <Flex gap={6} align="center">
      <WarningOutlined style={{ color: WARN }} />
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Thin: fewer than 30 photos, or fewer than 10 kept for verification
      </Typography.Text>
    </Flex>
  );
}

/** Each model's latest verified numbers, oldest first, against the bar. */
export function ProgressChart({ models }: { models: ModelProgress }) {
  if (!models.length)
    return <Empty description="No model verified on our photos yet: run a verification" />;
  const data = models.map((m) => ({
    name: m.name,
    visit: m.visitCorrect,
    dart: m.dartCorrect,
    board: m.boardFound,
    samples: m.samples,
  }));
  const lowest = Math.min(...data.flatMap((d) => [d.visit ?? 1, d.dart ?? 1, d.board ?? 1]));
  const floor = Math.max(0, Math.floor((lowest - 0.05) * 20) / 20);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: AXIS, fontSize: 12 }}
          padding={{ left: 16, right: 16 }}
        />
        <YAxis
          domain={[floor, 1]}
          tickFormatter={pct}
          tick={{ fill: AXIS, fontSize: 12 }}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => pct(Number(v))}
          labelFormatter={(n, p) => `${n} · ${p[0]?.payload.samples ?? '—'} photos`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine
          y={BAR.visit}
          stroke={AXIS}
          strokeDasharray="5 4"
          label={{ value: 'visit bar 90%', position: 'insideTopLeft', fill: AXIS, fontSize: 11 }}
        />
        <Line
          name="Visit"
          dataKey="visit"
          stroke={SERIES.visit}
          strokeWidth={2}
          dot={{ r: 4 }}
          isAnimationActive={false}
        />
        <Line
          name="Segment"
          dataKey="dart"
          stroke={SERIES.dart}
          strokeWidth={2}
          dot={{ r: 4 }}
          isAnimationActive={false}
        />
        <Line
          name="Board found"
          dataKey="board"
          stroke={SERIES.board}
          strokeWidth={2}
          dot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
