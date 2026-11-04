'use client';

import { DeleteOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import {
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Flex,
  InputNumber,
  Segmented,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type PointerEvent } from 'react';

import { CALIBRATION_IDS, type CalibrationId, type ImagePoint } from '@domain/camera';

import { measure } from '~/lib/conditions';
import { CORRECTED } from '~/lib/prefill';
import type { LabelDart, LabelInput } from '~/lib/labels';
import { boardDrawing, KEYPOINT_LABELS } from '~/lib/overlay';
import type { CaptureDetail } from '~/lib/queries';

import { dartColour, MARK, pointsMap, ReviewTags, SplitTag, StatusTag } from './CaptureBits';
import { PageBody, PageHeader } from './PageHeader';

/** The model's proposal, in the same colour as predictions on the Verification page. */
const MODEL = '#eb6834';

type Selected = { kind: 'point'; id: CalibrationId } | { kind: 'dart'; idx: number } | null;

const VALUE_OPTIONS = [
  ...['Bull', '25', 'Miss', 'Bounce-out'],
  ...Array.from({ length: 20 }, (_, i) => [`${i + 1}`, `D${i + 1}`, `T${i + 1}`]).flat(),
].map((value) => ({ value }));

const clamp = (v: number) => Math.min(1, Math.max(0, v));

function initial(c: CaptureDetail): LabelInput {
  return {
    points: pointsMap(c.points),
    darts: c.darts.map((d) => ({
      entered: d.entered,
      tip: d.x !== null && d.y !== null ? { x: d.x, y: d.y } : null,
      onWire: d.onWire,
    })),
    missed: c.missed,
  };
}

/**
 * The label editor (capture-lab.md › Pages › Capture): the photo with the board drawn through
 * the marks, draggable board points and dart tips, the darts with their entered and scored
 * values, and the label's history. Each save is a new label version.
 */
export function LabelEditor({ capture }: { capture: CaptureDetail }) {
  const { message } = App.useApp();
  const router = useRouter();
  const [label, setLabel] = useState<LabelInput>(() => initial(capture));
  const [selected, setSelected] = useState<Selected>(null);
  const [mode, setMode] = useState<'move' | 'add'>('move');
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dragging = useRef<Selected>(null);
  const svg = useRef<SVGSVGElement>(null);

  const { width: W, height: H } = capture;
  const r = Math.max(W, H) / 90;
  const measured = useMemo(() => measure(label, W, H), [label, W, H]);
  const board = useMemo(() => boardDrawing(label.points, W, H), [label.points, W, H]);
  // What the model placed on the phone, drawn under the label (shown by default when corrected).
  const prefill = capture.prefill;
  const [showModel, setShowModel] = useState(() => !!prefill && !prefill.accepted);
  const modelBoard = useMemo(
    () => (prefill ? boardDrawing(pointsMap(prefill.calibration), W, H) : null),
    [prefill, W, H],
  );

  const update = (next: LabelInput) => {
    setLabel(next);
    setDirty(true);
  };
  const toImage = (e: PointerEvent): ImagePoint | null => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return null;
    return {
      x: clamp((e.clientX - box.left) / box.width),
      y: clamp((e.clientY - box.top) / box.height),
    };
  };
  const place = (target: Selected, p: ImagePoint) => {
    if (!target) return;
    if (target.kind === 'point') update({ ...label, points: { ...label.points, [target.id]: p } });
    else
      update({
        ...label,
        darts: label.darts.map((d, i) => (i === target.idx ? { ...d, tip: p } : d)),
      });
  };

  const onBackgroundDown = (e: PointerEvent<SVGSVGElement>) => {
    const p = toImage(e);
    if (!p) return;
    // A selected point or dart with no position yet goes where you click.
    if (selected?.kind === 'point' && !label.points[selected.id]) return place(selected, p);
    if (selected?.kind === 'dart' && !label.darts[selected.idx]?.tip) return place(selected, p);
    if (mode === 'add') {
      const idx = label.darts.length;
      update({ ...label, darts: [...label.darts, { entered: null, tip: p, onWire: false }] });
      setSelected({ kind: 'dart', idx });
      setMode('move');
      return;
    }
    setSelected(null);
  };
  const startDrag = (target: Selected) => (e: PointerEvent) => {
    e.stopPropagation();
    setSelected(target);
    dragging.current = target;
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    const p = toImage(e);
    if (p) place(dragging.current, p);
  };
  const endDrag = () => {
    dragging.current = null;
  };

  const setDart = (idx: number, change: Partial<LabelDart>) =>
    update({ ...label, darts: label.darts.map((d, i) => (i === idx ? { ...d, ...change } : d)) });
  const removeDart = (idx: number) => {
    update({ ...label, darts: label.darts.filter((_, i) => i !== idx) });
    setSelected(null);
  };

  const save = async (andNext: boolean) => {
    setSaving(true);
    const res = await fetch(`/api/captures/${capture.id}/label`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(label),
    });
    setSaving(false);
    if (!res.ok) {
      message.error((await res.json().catch(() => null))?.error ?? 'Couldn’t save the label');
      return;
    }
    setDirty(false);
    message.success('Saved as a new label version');
    if (andNext && capture.nextReviewId) router.push(`/captures/${capture.nextReviewId}`);
    else router.refresh();
  };
  const looksRight = async () => {
    const res = await fetch(`/api/captures/${capture.id}/review`, { method: 'POST' });
    if (!res.ok) return message.error('Couldn’t update the review queue');
    message.success('Checked: out of the review queue');
    if (capture.nextReviewId) router.push(`/captures/${capture.nextReviewId}`);
    else router.refresh();
  };
  const setLeftOut = async (rejected: boolean) => {
    const res = await fetch(`/api/captures/${capture.id}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rejected }),
    });
    if (res.ok) {
      message.success(rejected ? 'Left out of training' : 'Back in the dataset');
      router.refresh();
    }
  };

  const isSel = (t: Selected) =>
    !!selected &&
    !!t &&
    selected.kind === t.kind &&
    (t.kind === 'point'
      ? selected.kind === 'point' && selected.id === t.id
      : selected.kind === 'dart' && selected.idx === t.idx);

  return (
    <>
      <PageHeader
        breadcrumb={
          <>
            <Link href="/captures">Captures</Link> / {capture.id}
          </>
        }
        title={
          <Space>
            Capture
            <SplitTag split={capture.split} />
            <StatusTag status={capture.status} />
          </Space>
        }
        extra={
          <Space wrap>
            <Button
              icon={<LeftOutlined />}
              disabled={!capture.prevId}
              href={capture.prevId ? `/captures/${capture.prevId}` : undefined}
            >
              Previous
            </Button>
            <Button
              disabled={!capture.nextId}
              href={capture.nextId ? `/captures/${capture.nextId}` : undefined}
            >
              Next <RightOutlined />
            </Button>
          </Space>
        }
      />
      <PageBody>
        <Flex wrap gap={16} align="flex-start">
          <Card size="small" style={{ flex: '3 1 560px', minWidth: 0 }}>
            <Flex wrap justify="space-between" gap={8} style={{ marginBottom: 12 }}>
              <Segmented
                value={mode}
                onChange={(v) => setMode(v as 'move' | 'add')}
                options={[
                  { label: 'Move', value: 'move' },
                  { label: 'Add dart', value: 'add' },
                ]}
              />
              <Space wrap>
                {prefill ? (
                  <Checkbox checked={showModel} onChange={(e) => setShowModel(e.target.checked)}>
                    <span style={{ color: MODEL }}>✕</span> What {prefill.model} placed
                  </Checkbox>
                ) : null}
                <Typography.Text type="secondary">Zoom</Typography.Text>
                <Segmented
                  value={zoom}
                  onChange={(v) => setZoom(Number(v))}
                  options={[
                    { label: '1×', value: 1 },
                    { label: '2×', value: 2 },
                    { label: '3×', value: 3 },
                  ]}
                />
              </Space>
            </Flex>
            <div
              style={{ overflow: 'auto', maxHeight: '75vh', borderRadius: 6, background: '#111' }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${zoom * 100}%`,
                  aspectRatio: `${W} / ${H}`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local photo */}
                <img
                  src={`/api/captures/${capture.id}/photo`}
                  alt={`Capture ${capture.id}`}
                  draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                />
                <svg
                  ref={svg}
                  viewBox={`0 0 ${W} ${H}`}
                  role="img"
                  aria-label="Label marks: drag a point or dart to move it"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    cursor: mode === 'add' ? 'crosshair' : 'default',
                    touchAction: 'none',
                  }}
                  onPointerDown={onBackgroundDown}
                  onPointerMove={onMove}
                  onPointerUp={endDrag}
                  onPointerCancel={endDrag}
                >
                  {showModel && prefill ? (
                    <g pointerEvents="none" stroke={MODEL} strokeLinecap="round">
                      {modelBoard ? (
                        <path
                          d={`${modelBoard.rings} ${modelBoard.wires}`}
                          fill="none"
                          strokeOpacity={0.8}
                          strokeWidth={r / 7}
                          strokeDasharray={`${r / 1.5} ${r / 2}`}
                        />
                      ) : null}
                      {[...prefill.calibration, ...prefill.tips.flatMap((t) => (t ? [t] : []))].map(
                        (p, i) => (
                          <g key={i} strokeWidth={r / 3.5}>
                            <line
                              x1={p.x * W - r * 0.8}
                              y1={p.y * H - r * 0.8}
                              x2={p.x * W + r * 0.8}
                              y2={p.y * H + r * 0.8}
                            />
                            <line
                              x1={p.x * W - r * 0.8}
                              y1={p.y * H + r * 0.8}
                              x2={p.x * W + r * 0.8}
                              y2={p.y * H - r * 0.8}
                            />
                          </g>
                        ),
                      )}
                    </g>
                  ) : null}
                  {board ? (
                    <path
                      d={`${board.rings} ${board.wires}`}
                      fill="none"
                      stroke={MARK.label}
                      strokeOpacity={0.75}
                      strokeWidth={r / 6}
                      pointerEvents="none"
                    />
                  ) : null}
                  {CALIBRATION_IDS.map((id) => {
                    const p = label.points[id];
                    if (!p) return null;
                    const sel = isSel({ kind: 'point', id });
                    return (
                      <g
                        key={id}
                        onPointerDown={startDrag({ kind: 'point', id })}
                        style={{ cursor: 'grab' }}
                      >
                        <circle
                          cx={p.x * W}
                          cy={p.y * H}
                          r={r * (sel ? 1.3 : 1)}
                          fill="rgba(14,18,23,0.35)"
                          stroke={MARK.label}
                          strokeWidth={r / (sel ? 2.5 : 3.5)}
                        />
                        <text
                          x={p.x * W + r * 1.5}
                          y={p.y * H - r * 1.2}
                          fontSize={r * 1.4}
                          fontWeight={700}
                          fill="#fff"
                          stroke={MARK.ink}
                          strokeWidth={r / 4}
                          paintOrder="stroke"
                          pointerEvents="none"
                        >
                          {KEYPOINT_LABELS[id]}
                        </text>
                      </g>
                    );
                  })}
                  {label.darts.map((d, idx) => {
                    if (!d.tip) return null;
                    const m = measured.darts[idx];
                    const sel = isSel({ kind: 'dart', idx });
                    return (
                      <g
                        key={idx}
                        onPointerDown={startDrag({ kind: 'dart', idx })}
                        style={{ cursor: 'grab' }}
                      >
                        <circle
                          cx={d.tip.x * W}
                          cy={d.tip.y * H}
                          r={r * (sel ? 1.5 : 1.2)}
                          fill={dartColour({ onWire: d.onWire, mismatch: m?.mismatch })}
                          stroke={sel ? '#fff' : MARK.ink}
                          strokeWidth={r / 3}
                        />
                        <text
                          x={d.tip.x * W}
                          y={d.tip.y * H + r * 0.5}
                          fontSize={r * 1.4}
                          fontWeight={700}
                          textAnchor="middle"
                          fill={MARK.ink}
                          pointerEvents="none"
                        >
                          {idx + 1}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              Drag a point or dart to move it. With a point or dart selected that has no position
              yet, click the photo to place it. A tip is where the dart enters the board.
            </Typography.Paragraph>
          </Card>

          <Flex vertical gap={16} style={{ flex: '1 1 340px', minWidth: 0 }}>
            <Card
              size="small"
              title="Darts"
              extra={
                <Button size="small" onClick={() => setMode('add')}>
                  Add dart
                </Button>
              }
            >
              <Table
                size="small"
                pagination={false}
                rowKey={(_, i) => String(i)}
                dataSource={label.darts.map((d, idx) => ({ ...d, idx, m: measured.darts[idx] }))}
                onRow={(row) => ({ onClick: () => setSelected({ kind: 'dart', idx: row.idx }) })}
                rowClassName={(row) =>
                  isSel({ kind: 'dart', idx: row.idx }) ? 'ant-table-row-selected' : ''
                }
                columns={[
                  { title: '#', render: (_, row) => row.idx + 1, width: 32 },
                  {
                    title: 'Entered',
                    render: (_, row) => (
                      <AutoComplete
                        size="small"
                        style={{ width: 96 }}
                        value={row.entered ?? ''}
                        options={VALUE_OPTIONS}
                        filterOption={(input, o) =>
                          o!.value.toLowerCase().startsWith(input.toLowerCase())
                        }
                        onChange={(v: string) => setDart(row.idx, { entered: v || null })}
                        placeholder="—"
                        aria-label={`Dart ${row.idx + 1} value`}
                      />
                    ),
                  },
                  {
                    title: 'Tip scores',
                    render: (_, row) =>
                      !row.tip ? (
                        <Typography.Text type="secondary">no tip</Typography.Text>
                      ) : row.m?.scored ? (
                        <Typography.Text type={row.m.mismatch ? 'danger' : undefined} strong>
                          {row.m.scored}
                          {row.m.nearWire ? <Tag style={{ marginLeft: 6 }}>near wire</Tag> : null}
                        </Typography.Text>
                      ) : (
                        <Typography.Text type="secondary">mark the board</Typography.Text>
                      ),
                  },
                  {
                    title: 'Wire',
                    render: (_, row) => (
                      <Checkbox
                        checked={row.onWire}
                        aria-label={`Dart ${row.idx + 1} on the wire`}
                        onChange={(e) => setDart(row.idx, { onWire: e.target.checked })}
                      />
                    ),
                    width: 48,
                  },
                  {
                    render: (_, row) => (
                      <Button
                        size="small"
                        type="text"
                        icon={<DeleteOutlined />}
                        aria-label={`Remove dart ${row.idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDart(row.idx);
                        }}
                      />
                    ),
                    width: 40,
                  },
                ]}
              />
              <Flex align="center" gap={8} style={{ marginTop: 12 }}>
                <Typography.Text>Missed the board, not in the photo</Typography.Text>
                <InputNumber
                  size="small"
                  min={0}
                  max={3}
                  value={label.missed}
                  onChange={(v) => update({ ...label, missed: v ?? 0 })}
                />
              </Flex>
              <div style={{ marginTop: 12 }}>
                {measured.review.length ? (
                  <ReviewTags review={measured.review.join(', ')} />
                ) : (
                  <Tag color="success">Every tip matches its value</Tag>
                )}
              </div>
              <Space wrap style={{ marginTop: 12 }}>
                <Button
                  type="primary"
                  loading={saving}
                  disabled={!dirty}
                  onClick={() => save(false)}
                >
                  Save label
                </Button>
                {capture.nextReviewId ? (
                  <Button loading={saving} onClick={() => save(true)} disabled={!dirty}>
                    Save, next to review
                  </Button>
                ) : null}
                {capture.review?.includes(CORRECTED) && !dirty ? (
                  <Button onClick={looksRight}>
                    Looks right{capture.nextReviewId ? ', next' : ''}
                  </Button>
                ) : null}
                <Button
                  disabled={!dirty}
                  onClick={() => {
                    setLabel(initial(capture));
                    setDirty(false);
                  }}
                >
                  Undo changes
                </Button>
                {capture.status === 'rejected' ? (
                  <Button onClick={() => setLeftOut(false)}>Put back in the dataset</Button>
                ) : (
                  <Button danger onClick={() => setLeftOut(true)}>
                    Leave out of training
                  </Button>
                )}
              </Space>
            </Card>

            <Card size="small" title="Board points">
              <Flex wrap gap={6}>
                {CALIBRATION_IDS.map((id) => (
                  <Button
                    key={id}
                    size="small"
                    type={isSel({ kind: 'point', id }) ? 'primary' : 'default'}
                    onClick={() => setSelected({ kind: 'point', id })}
                  >
                    {KEYPOINT_LABELS[id]} {label.points[id] ? '✓' : '· place'}
                  </Button>
                ))}
              </Flex>
              {selected?.kind === 'point' && label.points[selected.id] ? (
                <Button
                  size="small"
                  type="link"
                  style={{ paddingLeft: 0, marginTop: 8 }}
                  onClick={() => {
                    const points = { ...label.points };
                    delete points[selected.id];
                    update({ ...label, points });
                  }}
                >
                  Clear {KEYPOINT_LABELS[selected.id]} (not visible in the photo)
                </Button>
              ) : null}
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                {measured.fitResidualMm === null
                  ? 'Mark at least four points to fit the board.'
                  : `Fit: points agree to ${measured.fitResidualMm.toFixed(1)} mm.`}
              </Typography.Paragraph>
            </Card>

            <Card size="small" title="Photo">
              <Descriptions
                size="small"
                column={1}
                items={[
                  {
                    label: 'Session',
                    children: (
                      <Link href={`/captures?session=${capture.sessionId}`}>
                        {capture.sessionId}
                      </Link>
                    ),
                  },
                  { label: 'Taken', children: new Date(capture.takenAt).toLocaleString() },
                  ...(capture.tags.length
                    ? [{ label: 'Tags', children: capture.tags.join(' · ') }]
                    : []),
                  {
                    label: 'Camera angle',
                    children:
                      measured.angleDeg !== null
                        ? `${Math.round(measured.angleDeg)}° (from the marks)`
                        : '—',
                  },
                  {
                    label: 'Board size',
                    children:
                      measured.boardPx !== null ? `${Math.round(measured.boardPx)} px across` : '—',
                  },
                  {
                    label: 'Brightness',
                    children:
                      capture.conditions?.brightness != null
                        ? `${Math.round(capture.conditions.brightness)} / 255`
                        : '—',
                  },
                  { label: 'Size', children: `${W} × ${H}` },
                  ...(prefill
                    ? [
                        {
                          label: 'Pre-filled by',
                          children: (
                            <>
                              {prefill.model}:{' '}
                              {prefill.accepted ? (
                                <Tag color="success">kept as placed</Tag>
                              ) : (
                                <>
                                  board {prefill.boardKept ? 'kept' : 'corrected'}
                                  {prefill.boardMovedMm !== null && !prefill.boardKept
                                    ? ` (${prefill.boardMovedMm.toFixed(1)} mm)`
                                    : ''}
                                  , {prefill.tipsKept} of {prefill.tipsNeeded} tips kept
                                </>
                              )}
                            </>
                          ),
                        },
                      ]
                    : capture.prefillModel
                      ? [{ label: 'Pre-filled by', children: capture.prefillModel }]
                      : []),
                  ...(capture.deviceModel
                    ? [
                        {
                          label: 'Phone',
                          children: `${capture.deviceModel}${capture.zoom ? ` · ${capture.zoom}×` : ''}`,
                        },
                      ]
                    : []),
                ]}
              />
            </Card>

            <Card size="small" title="Label history">
              <Timeline
                items={capture.history.map((h) => ({
                  color: h.current ? 'green' : 'gray',
                  content: (
                    <>
                      <b>Version {h.version}</b>
                      {h.current ? ' · current' : ''}
                      <br />
                      <Typography.Text type="secondary">
                        {h.source === 'lab'
                          ? 'Edited in Lab'
                          : h.source === 'phone'
                            ? 'From the phone'
                            : 'Imported'}{' '}
                        · {new Date(h.createdAt).toLocaleString()}
                      </Typography.Text>
                    </>
                  ),
                }))}
              />
            </Card>
          </Flex>
        </Flex>
      </PageBody>
    </>
  );
}
