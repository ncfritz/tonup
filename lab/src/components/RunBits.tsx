'use client';

import { Tag } from 'antd';

import type { RunSummary } from '~/lib/runs';

const STATUS = {
  queued: { color: 'default', text: 'Queued' },
  running: { color: 'processing', text: 'Running' },
  done: { color: 'success', text: 'Done' },
  failed: { color: 'error', text: 'Failed' },
  cancelled: { color: 'default', text: 'Cancelled' },
} as const;

const STAGE: Record<string, string> = {
  snapshot: 'snapshotting the data',
  train: 'training',
  evaluate: 'verifying',
  export: 'exporting to Core ML',
};

export function RunStatus({ run }: { run: Pick<RunSummary, 'status' | 'stage'> }) {
  const s = STATUS[run.status];
  return (
    <Tag color={s.color}>
      {s.text}
      {run.status === 'running' && run.stage ? ` · ${STAGE[run.stage] ?? run.stage}` : ''}
    </Tag>
  );
}

export const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);

export function describeRun(r: Pick<RunSummary, 'params' | 'baseModel'>) {
  const p = r.params;
  const data = [p.deepdarts ? 'DeepDarts' : null, p.captures ? 'our captures' : null]
    .filter(Boolean)
    .join(' + ');
  return `${p.from === 'model' ? `Fine-tune from ${r.baseModel ?? 'a model'}` : 'From scratch'} · ${data} · ${p.epochs} epochs`;
}

export function duration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
