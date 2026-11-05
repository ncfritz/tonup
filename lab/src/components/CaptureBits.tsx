'use client';

import { Tag } from 'antd';

import { CORRECTED } from '~/lib/prefill';
import type { OverlayDart, OverlayPoint } from '~/lib/queries';
import { boardDrawing, type Points } from '~/lib/overlay';

// Lab's colours for what's drawn on photos: Ant Design's blue for label marks, amber for a dart
// flagged on the wire, red for one whose tip disagrees with its value.
export const MARK = { label: '#1677ff', wire: '#faad14', mismatch: '#ff4d4f', ink: '#0B0F13' };

const SPLIT_TAG = {
  train: { color: 'blue', text: 'Train' },
  val: { color: 'default', text: 'Val' },
  test: { color: 'orange', text: 'Verify' },
} as const;

/** The set a capture belongs to; `test` is shown as Verify, the verification set. */
export function SplitTag({ split }: { split: keyof typeof SPLIT_TAG }) {
  const t = SPLIT_TAG[split];
  return <Tag color={t.color}>{t.text}</Tag>;
}

export function StatusTag({ status }: { status: string }) {
  if (status === 'values-only') return <Tag>Values only</Tag>;
  if (status === 'unlabelled') return <Tag color="gold">To label</Tag>;
  if (status === 'rejected') return <Tag color="red">Left out</Tag>;
  return null;
}

export function ReviewTags({ review }: { review: string | null }) {
  if (!review) return null;
  return (
    <>
      {review.split(', ').map((r) => (
        <Tag key={r} color={r === CORRECTED ? 'volcano' : 'warning'}>
          {r}
        </Tag>
      ))}
    </>
  );
}

export const pointsMap = (points: OverlayPoint[]): Points =>
  Object.fromEntries(points.map((p) => [p.kind, { x: p.x, y: p.y }]));

export const dartColour = (d: Pick<OverlayDart, 'onWire'> & { mismatch?: boolean }) =>
  d.mismatch ? MARK.mismatch : d.onWire ? MARK.wire : MARK.label;

/** A capture's label drawn over its thumbnail: rings, board points and numbered darts. */
export function StaticOverlay({
  width,
  height,
  points,
  darts,
}: {
  width: number;
  height: number;
  points: OverlayPoint[];
  darts: OverlayDart[];
}) {
  const board = boardDrawing(pointsMap(points), width, height);
  const r = Math.max(width, height) / 70;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      aria-hidden
    >
      {board ? (
        <path
          d={`${board.rings} ${board.wires}`}
          fill="none"
          stroke={MARK.label}
          strokeOpacity={0.7}
          strokeWidth={r / 4}
        />
      ) : null}
      {points.map((p) => (
        <circle
          key={p.kind}
          cx={p.x * width}
          cy={p.y * height}
          r={r * 0.7}
          fill="none"
          stroke={MARK.label}
          strokeWidth={r / 3}
        />
      ))}
      {darts.map((d) =>
        d.x !== null && d.y !== null ? (
          <circle
            key={d.idx}
            cx={d.x * width}
            cy={d.y * height}
            r={r}
            fill={dartColour({
              onWire: d.onWire,
              mismatch:
                !!d.entered &&
                !!d.scored &&
                d.entered !== d.scored &&
                !['Miss', 'Bounce-out'].includes(d.entered),
            })}
            stroke={MARK.ink}
            strokeWidth={r / 3}
          />
        ) : null,
      )}
    </svg>
  );
}
