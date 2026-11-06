'use client';

import { Progress, Tag, Typography } from 'antd';

import type { EpochMetrics } from '~/lib/runs';

import styles from './RunEpochs.module.css';
import { SERIES } from './RunCharts';

/** Seconds as HH:MM:SS. */
export const hms = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
};

const LOSS = '#8c8c8c';
const VAL_LOSS = '#9254de';
const COLUMNS = [
  { key: 'loss', label: 'Loss' },
  { key: 'visit', label: 'Visits' },
  { key: 'dart', label: 'Darts' },
  { key: 'board', label: 'Board' },
  { key: 'val', label: 'Val loss' },
] as const;

/**
 * The epochs a row each: a finished one's training loss, validation visits, darts and board
 * found, and validation loss as small bars with their numbers, and how long it took; the one
 * running as a single bar of its steps, and its time so far.
 */
export function RunEpochs({
  metrics,
  epochs,
  running,
  elapsed,
}: {
  metrics: EpochMetrics[];
  epochs: number;
  /** The epoch in progress, its step of steps; null when none is. */
  running: { epoch: number; step: number; of: number } | null;
  /** Seconds the running epoch has been going. */
  elapsed: number;
}) {
  if (!metrics.length && !running) {
    return <Typography.Text type="secondary">No epochs yet.</Typography.Text>;
  }
  const lossTop = Math.max(...metrics.flatMap((m) => [m.loss, m.val_loss]), 1e-9);
  const accLow = Math.min(
    ...metrics.flatMap((m) => [m.visit_correct, m.dart_correct, m.board_found]),
    1,
  );
  // Accuracy bars from a little under the lowest to 100%, so epochs' differences show.
  const floor = Math.max(0, Math.floor((accLow - 0.05) * 20) / 20);
  const acc = (v: number) => Math.max(0.02, (v - floor) / (1 - floor));
  const cell = (key: (typeof COLUMNS)[number]['key'], m: EpochMetrics) => {
    const [v, frac, colour, text] =
      key === 'loss'
        ? [m.loss, m.loss / lossTop, LOSS, m.loss.toFixed(3)]
        : key === 'val'
          ? [m.val_loss, m.val_loss / lossTop, VAL_LOSS, m.val_loss.toFixed(3)]
          : key === 'visit'
            ? [m.visit_correct, acc(m.visit_correct), SERIES.visit, pctOf(m.visit_correct)]
            : key === 'dart'
              ? [m.dart_correct, acc(m.dart_correct), SERIES.dart, pctOf(m.dart_correct)]
              : [m.board_found, acc(m.board_found), SERIES.board, pctOf(m.board_found)];
    return (
      <span key={key} className={styles.metric} title={`${String(v)}`}>
        <span className={styles.track}>
          <span className={styles.fill} style={{ width: `${frac * 100}%`, background: colour }} />
        </span>
        <span className={styles.num}>{text}</span>
      </span>
    );
  };
  return (
    <div className={styles.table} role="table" aria-label="Epochs">
      <div className={`${styles.row} ${styles.head}`} role="row">
        <span role="columnheader">Epoch</span>
        {COLUMNS.map((c) => (
          <span key={c.key} role="columnheader">
            {c.label}
          </span>
        ))}
        <span role="columnheader" className={styles.time}>
          Time
        </span>
      </div>
      {metrics.map((m) => (
        <div key={m.epoch} className={`${styles.row} ${m.best ? styles.best : ''}`} role="row">
          <span className={styles.epoch}>
            {m.epoch}
            <Typography.Text type="secondary">/{m.epochs || epochs}</Typography.Text>
            {m.best ? (
              <Tag color="success" bordered={false} className={styles.tag}>
                best
              </Tag>
            ) : null}
          </span>
          {COLUMNS.map((c) => cell(c.key, m))}
          <span className={styles.time}>{hms(m.seconds)}</span>
        </div>
      ))}
      {running ? (
        <div className={`${styles.row} ${styles.live}`} role="row">
          <span className={styles.epoch}>
            {running.epoch}
            <Typography.Text type="secondary">/{epochs}</Typography.Text>
          </span>
          <span className={styles.span}>
            <Progress
              percent={Math.round((running.step / Math.max(1, running.of)) * 100)}
              status="active"
              size="small"
              format={() => `step ${running.step}/${running.of}`}
            />
          </span>
          <span className={styles.time}>{hms(elapsed)}</span>
        </div>
      ) : null}
      <Typography.Text type="secondary" className={styles.note}>
        Loss and val loss to scale with the highest; visits, darts and board found from{' '}
        {Math.round(floor * 100)}% to 100%.
      </Typography.Text>
    </div>
  );
}

const pctOf = (v: number) => `${(v * 100).toFixed(1)}%`;
