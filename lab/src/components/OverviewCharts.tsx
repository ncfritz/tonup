'use client';

import { Empty, Flex, Segmented, Typography } from 'antd';
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

import type { WeekCount } from '~/lib/queries';
import type { CoverageGrid, HeadToHead, ModelProgress } from '~/lib/verify';

import { BAR, legendOrder, SERIES, useChartTheme } from './RunCharts';
import { MODEL_COLORS, type Measure } from './VerifyCharts';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;
const tooltipStyle = { borderRadius: 6, fontSize: 12 };

const KEY: Record<Measure, 'visitCorrect' | 'dartCorrect' | 'boardFound'> = {
  visit: 'visitCorrect',
  dart: 'dartCorrect',
  board: 'boardFound',
};

/** One measure across the models, oldest first, against its shipping bar. */
export function MeasureChart({ models, measure }: { models: ModelProgress; measure: Measure }) {
  const { GRID, AXIS } = useChartTheme();
  if (!models.length) return <Empty description="No model verified on our photos yet" />;
  const data = models.map((m) => ({ name: m.name, v: m[KEY[measure]], samples: m.samples }));
  const lowest = Math.min(BAR[measure], ...data.map((d) => d.v ?? 1));
  const floor = Math.max(0, Math.floor((lowest - 0.03) * 20) / 20);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: AXIS, fontSize: 12 }}
          padding={{ left: 12, right: 12 }}
        />
        <YAxis
          domain={[floor, 1]}
          tickFormatter={pct}
          tick={{ fill: AXIS, fontSize: 12 }}
          width={44}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => pct1(Number(v))}
          labelFormatter={(n, p) => `${n} · ${p[0]?.payload.samples ?? '—'} photos`}
        />
        <ReferenceLine
          y={BAR[measure]}
          stroke={AXIS}
          strokeDasharray="5 4"
          label={{
            value: `ship bar ${Math.round(BAR[measure] * 100)}%`,
            position: 'insideBottomLeft',
            fill: AXIS,
            fontSize: 11,
          }}
        />
        <Line
          name={measure}
          dataKey="v"
          stroke={SERIES[measure]}
          strokeWidth={2}
          dot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** The latest model's number on a measure, and its change on the one before. */
export function measureNote(models: ModelProgress, measure: Measure) {
  const last = models.at(-1);
  const prev = models.at(-2);
  const v = last?.[KEY[measure]];
  if (!last || v == null) return null;
  const p = prev?.[KEY[measure]];
  const d = p != null ? (v - p) * 100 : null;
  return (
    <Typography.Text type="secondary">
      {last.name} <Typography.Text strong>{pct1(v)}</Typography.Text>
      {d != null ? ` · ${d >= 0 ? '▲' : '▼'}${Math.abs(d).toFixed(1)} on ${prev!.name}` : ''}
    </Typography.Text>
  );
}

/** Labelled photos a week, stacked by set. */
export function WeeklyChart({ weeks }: { weeks: WeekCount[] }) {
  const { GRID, AXIS, CURSOR } = useChartTheme();
  if (!weeks.some((w) => w.train + w.val + w.test)) {
    return <Empty description="No labelled photos yet" />;
  }
  const data = weeks.map((w) => ({
    ...w,
    label: new Date(w.week).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
  }));
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
          itemSorter={legendOrder(['train', 'val', 'test'])}
        />
        <Bar
          name="Train"
          dataKey="train"
          stackId="w"
          fill={MODEL_COLORS[0]}
          isAnimationActive={false}
        />
        <Bar
          name="Val"
          dataKey="val"
          stackId="w"
          fill={MODEL_COLORS[1]}
          isAnimationActive={false}
        />
        <Bar
          name="Verify"
          dataKey="test"
          stackId="w"
          fill={MODEL_COLORS[2]}
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Photos by two conditions at once, each cell shaded by how many; thin cells marked. */
export function CoverageHeatmap({ grid, thin }: { grid: CoverageGrid; thin: number }) {
  const { AXIS } = useChartTheme();
  const max = Math.max(1, ...grid.cells.flat());
  const total = grid.cells.flat().reduce((a, b) => a + b, 0);
  if (!total) return <Empty description="No measured photos yet" />;
  const shade = (n: number) =>
    `color-mix(in srgb, ${MODEL_COLORS[0]} ${Math.round(8 + 80 * (n / max))}%, transparent)`;
  return (
    <Flex vertical gap={10}>
      <div
        role="table"
        aria-label={`${grid.rows.title} by ${grid.cols.title}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `minmax(72px, auto) repeat(${grid.cols.buckets.length}, minmax(0, 1fr))`,
          gap: 4,
          fontSize: 13,
        }}
      >
        <span role="columnheader" style={{ color: AXIS, fontSize: 12 }}>
          {grid.rows.title} ↓ · {grid.cols.title} →
        </span>
        {grid.cols.buckets.map((c) => (
          <span
            key={c}
            role="columnheader"
            style={{ color: AXIS, textAlign: 'center', fontSize: 12 }}
          >
            {c}
          </span>
        ))}
        {grid.rows.buckets.map((r, i) => (
          <div key={r} role="row" style={{ display: 'contents' }}>
            <span role="rowheader" style={{ color: AXIS, alignSelf: 'center' }}>
              {r}
            </span>
            {grid.cols.buckets.map((c, j) => {
              const n = grid.cells[i]![j]!;
              const few = n < thin;
              return (
                <span
                  key={c}
                  role="cell"
                  title={`${r}, ${c}: ${n} photos`}
                  style={{
                    minHeight: 44,
                    borderRadius: 6,
                    background: n ? shade(n) : 'var(--ant-color-fill-quaternary)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {n}
                  {few ? (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'var(--ant-color-warning-text)',
                      }}
                    >
                      thin
                    </span>
                  ) : null}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Labelled photos; under {thin} in a cell is thin.
        {grid.unmeasured ? ` ${grid.unmeasured} without a measure aren't counted.` : ''}
      </Typography.Text>
    </Flex>
  );
}

/**
 * The active model against the candidate, a row per condition bucket: a dot each, joined, and
 * the change; the shipping bar dashed. A switch picks the measure.
 */
export function HeadToHeadChart({ h }: { h: HeadToHead }) {
  const { GRID, AXIS } = useChartTheme();
  const [measure, setMeasure] = useState<Measure>('visit');
  const values = h.rows.flatMap((r) => [r.a[measure], r.b[measure]]);
  const lo = Math.max(0, Math.floor((Math.min(BAR[measure], ...values) - 0.05) * 10) / 10);
  const W = 640;
  const left = 170;
  const right = 56;
  const rowH = 30;
  const H = h.rows.length * rowH + 40;
  const x = (v: number) => left + ((v - lo) / (1 - lo)) * (W - left - right);
  const ticks = Array.from({ length: Math.round((1 - lo) * 10) + 1 }, (_, i) => lo + i / 10);
  return (
    <Flex vertical gap={8}>
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Segmented<Measure>
          size="small"
          value={measure}
          onChange={setMeasure}
          options={[
            { value: 'visit', label: 'Visit' },
            { value: 'dart', label: 'Segment' },
            { value: 'board', label: 'Board' },
          ]}
        />
        <Flex gap={14} style={{ fontSize: 12, color: AXIS }}>
          <span>
            <Dot color={MODEL_COLORS[0]!} /> {h.active.name} active
          </span>
          <span>
            <Dot color={MODEL_COLORS[1]!} /> {h.candidate.name} candidate
          </span>
        </Flex>
      </Flex>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label={`${h.active.name} against ${h.candidate.name} by condition`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={8} y2={H - 24} stroke={GRID} />
            <text x={x(t)} y={H - 8} fontSize={11} fill={AXIS} textAnchor="middle">
              {pct(t)}
            </text>
          </g>
        ))}
        <line
          x1={x(BAR[measure])}
          x2={x(BAR[measure])}
          y1={8}
          y2={H - 24}
          stroke={AXIS}
          strokeDasharray="5 4"
          strokeWidth={1.5}
        />
        {h.rows.map((r, i) => {
          const y = 22 + i * rowH;
          const a = r.a[measure];
          const b = r.b[measure];
          const d = (b - a) * 100;
          return (
            <g key={`${r.condition}${r.bucket}`}>
              <title>{`${r.condition}: ${r.bucket} · ${r.n} photos · ${h.active.name} ${pct1(a)}, ${h.candidate.name} ${pct1(b)}`}</title>
              <text x={8} y={y + 4} fontSize={12} fill="currentColor">
                {r.label}
                <tspan fill={AXIS} fontSize={11}>{`  n ${r.n}`}</tspan>
              </text>
              <line
                x1={x(a)}
                x2={x(b)}
                y1={y}
                y2={y}
                stroke={GRID}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={x(a)} cy={y} r={6} fill={MODEL_COLORS[0]} />
              <circle cx={x(b)} cy={y} r={6} fill={MODEL_COLORS[1]} />
              <text
                x={W - 8}
                y={y + 4}
                fontSize={11}
                fontWeight={600}
                textAnchor="end"
                fill={d >= 0 ? 'var(--ant-color-success-text)' : 'var(--ant-color-error-text)'}
              >
                {`${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`}
              </text>
            </g>
          );
        })}
      </svg>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Verification #{h.runId}, the same {h.samples} verify photos for both; few photos in a
        condition make its numbers swing.
      </Typography.Text>
    </Flex>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 5,
        background: color,
        verticalAlign: 'middle',
      }}
    />
  );
}
