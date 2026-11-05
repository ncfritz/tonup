'use client';

import {
  AimOutlined,
  CameraOutlined,
  DeleteOutlined,
  HistoryOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  App,
  AutoComplete,
  Button,
  Checkbox,
  Descriptions,
  Flex,
  InputNumber,
  Popconfirm,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';

import { CALIBRATION_IDS, type CalibrationId, type ImagePoint } from '@domain/camera';

import { measure } from '~/lib/conditions';
import { CORRECTED } from '~/lib/prefill';
import type { LabelDart, LabelInput } from '~/lib/labels';
import { boardDrawing, KEYPOINT_LABELS } from '~/lib/overlay';
import type { CaptureDetail } from '~/lib/queries';

import { dartColour, MARK, pointsMap, ReviewTags, SplitTag, StatusTag } from './CaptureBits';
import styles from './LabelEditor.module.css';
import { PageHeader } from './PageHeader';
import { SideTabs, type SideTab } from './SideTabs';

/** Zoom: the most, a button's step, and how far a press moves before it's a drag (px). */
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.5;
const PAN_SLOP = 4;

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
  // The photo zooms by growing inside a scrolling frame: the wheel zooms about the cursor, a drag
  // on the photo (not on a mark) pans it, and a press that doesn't move is a click.
  const frame = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(
    null,
  );
  const [panning, setPanning] = useState(false);
  // The space the photo has, and the photo's size in it: as wide as it is, unless that would
  // be too tall, then as tall as it is.
  const stage = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ width: number; height: number } | null>(null);
  const zoomRef = useRef(zoom);
  const anchor = useRef<{ fx: number; fy: number; mx: number; my: number } | null>(null);

  const { width: W, height: H } = capture;
  // Marks in photo units, divided by the zoom so they keep their size on screen.
  const r = Math.max(W, H) / 90 / zoom;
  const measured = useMemo(() => measure(label, W, H), [label, W, H]);
  const board = useMemo(() => boardDrawing(label.points, W, H), [label.points, W, H]);
  // What the model placed on the phone, drawn under the label (shown by default when corrected).
  const prefill = capture.prefill;
  const [showModel, setShowModel] = useState(() => !!prefill && !prefill.accepted);
  const modelBoard = useMemo(
    () => (prefill ? boardDrawing(pointsMap(prefill.calibration), W, H) : null),
    [prefill, W, H],
  );

  /** Zooms to `z`, keeping the photo point under (mx, my) — frame coordinates — where it is. */
  const zoomTo = (z: number, at?: { mx: number; my: number }) => {
    const el = frame.current;
    const next = Math.min(MAX_ZOOM, Math.max(1, z));
    if (!el || next === zoomRef.current) return;
    const mx = at?.mx ?? el.clientWidth / 2;
    const my = at?.my ?? el.clientHeight / 2;
    anchor.current = {
      fx: (el.scrollLeft + mx) / el.scrollWidth,
      fy: (el.scrollTop + my) / el.scrollHeight,
      mx,
      my,
    };
    zoomRef.current = next;
    setZoom(next);
  };
  // After the photo has grown, scroll so the anchored point is back under the cursor.
  useLayoutEffect(() => {
    const el = frame.current;
    const a = anchor.current;
    if (!el || !a) return;
    el.scrollLeft = a.fx * el.scrollWidth - a.mx;
    el.scrollTop = a.fy * el.scrollHeight - a.my;
    anchor.current = null;
  }, [zoom]);
  // The wheel zooms the photo instead of scrolling the page (a listener React can't make
  // non-passive). Trackpad pinches arrive as wheel events with ctrl held, and zoom the same way.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const step = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      zoomTo(zoomRef.current * step, { mx: e.clientX - box.left, my: e.clientY - box.top });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measureFit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      const width = Math.min(w, (h * W) / H);
      setFit({ width: Math.floor(width), height: Math.floor((width * H) / W) });
    };
    // It reports the stage's size once on observing, then on every change.
    const ro = new ResizeObserver(measureFit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W, H]);

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

  /** A click on the photo (not on a mark): place, add, or let go of the selection. */
  const clickPhoto = (p: ImagePoint) => {
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
  const onBackgroundDown = (e: PointerEvent<SVGSVGElement>) => {
    const el = frame.current;
    if (!el || e.button !== 0) return;
    pan.current = {
      x: e.clientX,
      y: e.clientY,
      left: el.scrollLeft,
      top: el.scrollTop,
      moved: false,
    };
    svg.current?.setPointerCapture(e.pointerId);
  };
  const startDrag = (target: Selected) => (e: PointerEvent) => {
    e.stopPropagation();
    setSelected(target);
    dragging.current = target;
    svg.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const pn = pan.current;
    if (pn && frame.current) {
      const dx = e.clientX - pn.x;
      const dy = e.clientY - pn.y;
      if (!pn.moved && Math.hypot(dx, dy) < PAN_SLOP) return;
      if (!pn.moved) setPanning(true);
      pn.moved = true;
      frame.current.scrollLeft = pn.left - dx;
      frame.current.scrollTop = pn.top - dy;
      return;
    }
    if (!dragging.current) return;
    const p = toImage(e);
    if (p) place(dragging.current, p);
  };
  const endDrag = (e: PointerEvent<SVGSVGElement>) => {
    const pn = pan.current;
    pan.current = null;
    setPanning(false);
    if (pn && !pn.moved) {
      const p = toImage(e);
      if (p) clickPhoto(p);
    }
    dragging.current = null;
  };
  const cancelDrag = () => {
    pan.current = null;
    setPanning(false);
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
  const deleteCapture = async () => {
    const res = await fetch(`/api/captures/${capture.id}`, { method: 'DELETE' });
    if (!res.ok) return message.error('Couldn’t delete the capture');
    message.success('Capture deleted');
    // On to the next photo of the session, or back to its gallery.
    const next = capture.nextId ?? capture.prevId;
    router.push(next ? `/captures/${next}` : `/captures?session=${capture.sessionId}`);
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

  const sideTabs: SideTab[] = [
    {
      key: 'points',
      icon: <AimOutlined />,
      title: 'Board points',
      children: (
        <>
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
        </>
      ),
    },
    {
      key: 'photo',
      icon: <CameraOutlined />,
      title: 'Photo',
      children: (
        <Descriptions
          size="small"
          column={1}
          items={[
            {
              label: 'Session',
              children: (
                <Link href={`/captures?session=${capture.sessionId}`}>{capture.sessionId}</Link>
              ),
            },
            { label: 'Taken', children: new Date(capture.takenAt).toLocaleString() },
            ...(capture.tags.length ? [{ label: 'Tags', children: capture.tags.join(' · ') }] : []),
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
      ),
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      title: 'Label history',
      children: (
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
      ),
    },
  ];

  return (
    <div className={styles.page}>
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
      <div className={styles.work}>
        <div className={styles.photoArea}>
          <Flex wrap justify="space-between" align="center" gap={8}>
            {mode === 'add' ? (
              <Typography.Text strong>Click the photo where the new dart’s tip is</Typography.Text>
            ) : (
              <Typography.Text type="secondary">
                Scroll to zoom, drag the photo to move around
              </Typography.Text>
            )}
            <Space wrap>
              {prefill ? (
                <Checkbox checked={showModel} onChange={(e) => setShowModel(e.target.checked)}>
                  <span style={{ color: MODEL }}>✕</span> What {prefill.model} placed
                </Checkbox>
              ) : null}
              <Space.Compact>
                <Button
                  icon={<MinusOutlined />}
                  aria-label="Zoom out"
                  disabled={zoom <= 1}
                  onClick={() => zoomTo(zoom / ZOOM_STEP)}
                />
                <Button style={{ minWidth: 64 }} onClick={() => zoomTo(1)} title="Fit the photo">
                  {zoom <= 1 ? 'Fit' : `${zoom.toFixed(1)}×`}
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  aria-label="Zoom in"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() => zoomTo(zoom * ZOOM_STEP)}
                />
              </Space.Compact>
            </Space>
          </Flex>
          {/* The photo fits the space left: the full width when that leaves it short enough,
              otherwise the full height. Zooming scrolls inside this frame rather than growing it. */}
          <div
            ref={stage}
            className={styles.stage}
            style={{ ['--ratio' as string]: `${W} / ${H}` }}
          >
            <div
              ref={frame}
              className={styles.frame}
              style={fit ? { width: fit.width, height: fit.height } : { visibility: 'hidden' }}
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
                    cursor: panning
                      ? 'grabbing'
                      : mode === 'add'
                        ? 'crosshair'
                        : zoom > 1
                          ? 'grab'
                          : 'default',
                    touchAction: 'none',
                  }}
                  onPointerDown={onBackgroundDown}
                  onPointerMove={onMove}
                  onPointerUp={endDrag}
                  onPointerCancel={cancelDrag}
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
          </div>
        </div>

        <div className={styles.scores}>
          <Flex justify="space-between" align="center" style={{ marginBottom: 12 }}>
            <Typography.Text strong>Darts</Typography.Text>
            <Button
              size="small"
              type={mode === 'add' ? 'primary' : 'default'}
              icon={mode === 'add' ? null : <PlusOutlined />}
              onClick={() => setMode(mode === 'add' ? 'move' : 'add')}
              aria-pressed={mode === 'add'}
            >
              {mode === 'add' ? 'Cancel adding' : 'Add dart'}
            </Button>
          </Flex>
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
            <Button type="primary" loading={saving} disabled={!dirty} onClick={() => save(false)}>
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
            <Popconfirm
              title="Delete this capture?"
              description="Its photo and every label version go. This can’t be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={deleteCapture}
            >
              <Button danger type="text" icon={<DeleteOutlined />}>
                Delete
              </Button>
            </Popconfirm>
          </Space>
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            Drag a point or dart to move it. With a point or dart selected that has no position yet,
            click the photo to place it. A tip is where the dart enters the board.
          </Typography.Paragraph>
        </div>

        <SideTabs id="capture" tabs={sideTabs} />
      </div>
    </div>
  );
}
