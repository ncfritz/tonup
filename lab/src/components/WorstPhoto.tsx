'use client';

import { CALIBRATION_IDS, type CalibrationId } from '@domain/camera';
import { Card, Flex, Tag, Typography } from 'antd';
import Link from 'next/link';

import { boardDrawing, type Points } from '~/lib/overlay';
import type { WorstItem } from '~/lib/verify';

/** True label and model prediction, the same colours on every photo. */
export const TRUTH = '#1baf7a';
export const PREDICTED = '#eb6834';

/** One photo the model got wrong: the board it found and its tips over the true tips. */
export function WorstPhoto({ item, color }: { item: WorstItem; color?: string }) {
  const { width: w, height: h } = item;
  const predicted: Points = {};
  for (const id of CALIBRATION_IDS) {
    const p = item.predicted.calibration[id];
    if (p) predicted[id as CalibrationId] = { x: p[0], y: p[1] };
  }
  const board = boardDrawing(predicted, w, h);
  const s = Math.max(w, h) / 120; // marker size in photo pixels, about 3px on the card
  const truthTips = item.truth?.tips ?? [];
  return (
    <Card
      size="small"
      styles={{ body: { padding: 8 } }}
      cover={
        <Link
          href={`/captures/${item.captureId}`}
          style={{ position: 'relative', display: 'block' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/captures/${item.captureId}/thumb`}
            alt=""
            style={{
              width: '100%',
              aspectRatio: `${w} / ${h}`,
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <svg
            viewBox={`0 0 ${w} ${h}`}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            {board ? (
              <g fill="none" stroke={PREDICTED} strokeWidth={s / 2.5} opacity={0.85}>
                <path d={board.rings} />
                <path d={board.wires} opacity={0.6} />
              </g>
            ) : null}
            {truthTips.map((t, i) => (
              <circle
                key={`t${i}`}
                cx={t.x * w}
                cy={t.y * h}
                r={s * 1.2}
                fill="none"
                stroke={TRUTH}
                strokeWidth={s / 1.6}
                paintOrder="stroke"
              />
            ))}
            {item.predicted.tips.map(([x, y], i) => (
              <g key={`p${i}`} stroke={PREDICTED} strokeWidth={s / 1.6} strokeLinecap="round">
                <line x1={x * w - s} y1={y * h - s} x2={x * w + s} y2={y * h + s} />
                <line x1={x * w - s} y1={y * h + s} x2={x * w + s} y2={y * h - s} />
              </g>
            ))}
          </svg>
        </Link>
      }
    >
      <Flex justify="space-between" align="center" gap={6} wrap>
        <Typography.Text style={{ fontSize: 12 }}>
          {color ? (
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: 4,
                background: color,
                marginRight: 6,
              }}
            />
          ) : null}
          <b>{item.model}</b> · want {item.wantTotal}, got {item.gotTotal ?? '—'}
        </Typography.Text>
        {!item.boardFound ? (
          <Tag color="error" style={{ marginInlineEnd: 0 }}>
            board not found
          </Tag>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {item.dartsRight}/{item.darts} darts
          </Typography.Text>
        )}
      </Flex>
      {item.valuesOnly ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Values only: {item.truth?.values.join(', ')}
        </Typography.Text>
      ) : null}
    </Card>
  );
}
