'use client';

import { Progress, Typography } from 'antd';

import { SEGMENT_ORDER, STEEL_TIP_RADII_MM as R } from '@domain/board';

import { useDark } from './colorMode';
import styles from './HitBoard.module.css';

/** What a value is: a single, double or treble of a number, a bull, or off the board. */
export type HitKind = 'single' | 'double' | 'treble' | 'bull' | 'miss';

export function kindOf(v: string): { kind: HitKind; segment: number | null } {
  const m = /^([TD]?)(\d+)$/.exec(v);
  if (m) {
    const n = Number(m[2]);
    if (n === 25) return { kind: 'bull', segment: 25 };
    return { kind: m[1] === 'T' ? 'treble' : m[1] === 'D' ? 'double' : 'single', segment: n };
  }
  if (v === 'Bull') return { kind: 'bull', segment: 50 };
  return { kind: 'miss', segment: null };
}

/** A colour per kind, for the list's bars (the heatmap is one scale). */
export const KIND_COLOUR: Record<HitKind, string> = {
  single: '#1677ff',
  double: '#52c41a',
  treble: '#fa541c',
  bull: '#722ed1',
  miss: '#8c8c8c',
};
const HEAT = '#fa541c';

const KIND_ORDER: HitKind[] = ['treble', 'double', 'single', 'bull', 'miss'];

/** A ring sector from r0 to r1 (mm), centred on `deg` (0 up, clockwise), `span` wide. */
function sector(r0: number, r1: number, deg: number, span: number, k: number, c: number) {
  const a0 = ((deg - span / 2 - 90) * Math.PI) / 180;
  const a1 = ((deg + span / 2 - 90) * Math.PI) / 180;
  const p = (r: number, a: number) =>
    `${(c + r * k * Math.cos(a)).toFixed(2)} ${(c + r * k * Math.sin(a)).toFixed(2)}`;
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1 * k} ${r1 * k} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0 * k} ${r0 * k} 0 0 0 ${p(r0, a0)} Z`;
}

/**
 * Where the shown captures' darts landed: the board as a heatmap (each bed filled by how many
 * darts it took, a single's two beds alike), and the values as a list, most first, a bar each
 * coloured by kind.
 */
export function HitBoard({ hits, darts }: { hits: Record<string, number>; darts: number }) {
  const dark = useDark();
  const size = 300;
  const c = size / 2;
  const k = (c - 22) / R.doubleOuter;
  const max = Math.max(1, ...Object.values(hits));
  const heat = (n: number) => (n ? 0.12 + 0.88 * Math.pow(n / max, 0.7) : 0);
  const bed = dark ? ['#262626', '#1f1f1f'] : ['#f0f0f0', '#e2e2e2'];
  const wire = dark ? '#434343' : '#bfbfbf';
  const text = dark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.65)';

  const beds = SEGMENT_ORDER.flatMap((seg, i) => {
    const deg = i * 18;
    const shade = bed[i % 2]!;
    return [
      {
        key: `S${seg}i`,
        d: sector(R.outerBull, R.trebleInner, deg, 18, k, c),
        n: hits[String(seg)] ?? 0,
        shade,
        label: `${seg}`,
      },
      {
        key: `T${seg}`,
        d: sector(R.trebleInner, R.trebleOuter, deg, 18, k, c),
        n: hits[`T${seg}`] ?? 0,
        shade,
        label: `T${seg}`,
      },
      {
        key: `S${seg}o`,
        d: sector(R.trebleOuter, R.doubleInner, deg, 18, k, c),
        n: hits[String(seg)] ?? 0,
        shade,
        label: `${seg}`,
      },
      {
        key: `D${seg}`,
        d: sector(R.doubleInner, R.doubleOuter, deg, 18, k, c),
        n: hits[`D${seg}`] ?? 0,
        shade,
        label: `D${seg}`,
      },
    ];
  });
  const list = Object.entries(hits)
    .map(([v, n]) => ({ v, n, ...kindOf(v) }))
    .sort((a, b) => b.n - a.n || KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  const misses = list.filter((h) => h.kind === 'miss').reduce((s, h) => s + h.n, 0);

  if (!darts) {
    return (
      <Typography.Text type="secondary">
        No darts with a value in the captures shown.
      </Typography.Text>
    );
  }
  return (
    <div className={styles.wrap}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className={styles.board}
        role="img"
        aria-label={`Where ${darts} darts landed: most on ${list[0]?.v}`}
      >
        {beds.map((b) => (
          <g key={b.key}>
            <path d={b.d} fill={b.shade} stroke={wire} strokeWidth={0.6} />
            {b.n ? <path d={b.d} fill={HEAT} fillOpacity={heat(b.n)} /> : null}
            <title>{`${b.label}: ${b.n}`}</title>
          </g>
        ))}
        <circle cx={c} cy={c} r={R.outerBull * k} fill={bed[0]} stroke={wire} strokeWidth={0.6} />
        {hits['25'] ? (
          <circle cx={c} cy={c} r={R.outerBull * k} fill={HEAT} fillOpacity={heat(hits['25'])} />
        ) : null}
        <circle cx={c} cy={c} r={R.innerBull * k} fill={bed[1]} stroke={wire} strokeWidth={0.6} />
        {hits.Bull ? (
          <circle cx={c} cy={c} r={R.innerBull * k} fill={HEAT} fillOpacity={heat(hits.Bull)} />
        ) : null}
        {SEGMENT_ORDER.map((seg, i) => {
          const a = ((i * 18 - 90) * Math.PI) / 180;
          const r = R.doubleOuter * k + 11;
          return (
            <text
              key={seg}
              x={c + r * Math.cos(a)}
              y={c + r * Math.sin(a)}
              fontSize={11}
              fontWeight={600}
              fill={text}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {seg}
            </text>
          );
        })}
      </svg>
      <div className={styles.scale} aria-hidden>
        <span>Fewer</span>
        <span
          className={styles.ramp}
          style={{ background: `linear-gradient(to right, ${bed[0]}, ${HEAT})` }}
        />
        <span>More</span>
      </div>
      <Typography.Text type="secondary" className={styles.note}>
        {darts.toLocaleString()} darts{misses ? `, ${misses} off the board` : ''}. A single’s two
        beds are filled alike.
      </Typography.Text>
      <div className={styles.legend}>
        {KIND_ORDER.map((kind) => (
          <span key={kind} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: KIND_COLOUR[kind] }} />
            {kind === 'single'
              ? 'Single'
              : kind === 'double'
                ? 'Double'
                : kind === 'treble'
                  ? 'Treble'
                  : kind === 'bull'
                    ? 'Bull'
                    : 'Off the board'}
          </span>
        ))}
      </div>
      <ul className={styles.list} aria-label="Darts by value">
        {list.map((h) => (
          <li key={h.v} className={styles.row}>
            <span className={styles.value}>{h.v}</span>
            <Progress
              percent={(h.n / max) * 100}
              showInfo={false}
              strokeColor={KIND_COLOUR[h.kind]}
              size="small"
              className={styles.bar}
            />
            <span className={styles.count}>
              {h.n}
              <Typography.Text type="secondary">
                {' '}
                · {Math.round((h.n / darts) * 100)}%
              </Typography.Text>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
