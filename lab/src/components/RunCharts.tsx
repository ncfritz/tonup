'use client';

import { Empty } from 'antd';
import {
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

import type { EpochMetrics } from '~/lib/runs';

// The validated categorical order (blue, orange, aqua), one hue per measure on every chart.
export const SERIES = { visit: '#2a78d6', dart: '#eb6834', board: '#1baf7a' };
const GRID = '#f0f0f0';
const AXIS = '#595959';

/** The shipping bar (docs/plan/snap-to-score.md › Accuracy bar). */
export const BAR = { visit: 0.9, dart: 0.95, board: 0.98 };

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Legend items in the order the series are drawn (Recharts sorts them by name otherwise). */
export const legendOrder =
  (keys: string[]) =>
  (item: { dataKey?: unknown }): number =>
    keys.indexOf(String(item.dataKey));

export function AccuracyChart({ metrics, epochs }: { metrics: EpochMetrics[]; epochs: number }) {
  if (!metrics.length) return <Empty description="No epochs finished yet" />;
  const data = metrics.map((m) => ({
    epoch: m.epoch,
    visit: m.visit_correct,
    dart: m.dart_correct,
    board: m.board_found,
  }));
  const lowest = Math.min(...data.flatMap((d) => [d.visit, d.dart, d.board]));
  const floor = Math.max(0, Math.floor((lowest - 0.05) * 20) / 20);
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="epoch"
          type="number"
          domain={[1, Math.max(epochs, 2)]}
          tick={{ fill: AXIS, fontSize: 12 }}
          allowDecimals={false}
          label={{
            value: 'epoch',
            position: 'insideBottomRight',
            offset: -2,
            fill: AXIS,
            fontSize: 12,
          }}
        />
        <YAxis
          domain={[floor, 1]}
          tickFormatter={pct}
          tick={{ fill: AXIS, fontSize: 12 }}
          width={48}
        />
        <Tooltip formatter={(v) => pct(Number(v))} labelFormatter={(e) => `Epoch ${e}`} />
        <Legend itemSorter={legendOrder(['visit', 'dart', 'board'])} />
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
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          name="Segment"
          dataKey="dart"
          stroke={SERIES.dart}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          name="Board found"
          dataKey="board"
          stroke={SERIES.board}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LossChart({ metrics, epochs }: { metrics: EpochMetrics[]; epochs: number }) {
  if (!metrics.length) return <Empty description="No epochs finished yet" />;
  const data = metrics.map((m) => ({ epoch: m.epoch, train: m.loss, val: m.val_loss }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 24, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="epoch"
          type="number"
          domain={[1, Math.max(epochs, 2)]}
          tick={{ fill: AXIS, fontSize: 12 }}
          allowDecimals={false}
          label={{
            value: 'epoch',
            position: 'insideBottomRight',
            offset: -2,
            fill: AXIS,
            fontSize: 12,
          }}
        />
        <YAxis tick={{ fill: AXIS, fontSize: 12 }} width={48} domain={[0, 'auto']} />
        <Tooltip formatter={(v) => Number(v).toFixed(3)} labelFormatter={(e) => `Epoch ${e}`} />
        <Legend itemSorter={legendOrder(['train', 'val'])} />
        <Line
          name="Train"
          dataKey="train"
          stroke={SERIES.visit}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
        <Line
          name="Validation"
          dataKey="val"
          stroke={SERIES.dart}
          strokeWidth={2}
          dot={{ r: 3 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
