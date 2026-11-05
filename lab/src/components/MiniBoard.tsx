'use client';

import { hitAt, SEGMENT_DEGREES, SEGMENT_ORDER, segmentCentreDegrees } from '@domain/board';

import { useDark } from './colorMode';

/**
 * A small grey dartboard (the label editor's darts and board points): a region lit in the
 * accent with the rest of its segment tinted, an outlined second region (what was entered, when
 * a tip scores something else), or a dot where a board point goes. Drawn in board millimetres, the 20 at the top.
 */

/**
 * A grey board in each mode, and Ant Design's blue for what's lit (the rest of its segment in a
 * strong tint, so a small treble or double still reads), red for what was entered instead.
 */
const PALETTES = {
  light: {
    edge: '#8c8c8c',
    seg: ['#cfcfcf', '#f0f0f0'],
    ring: ['#9c9c9c', '#bababa'],
    lit: '#1677ff',
    litSoft: '#91caff',
    danger: '#ff4d4f',
    dotStroke: '#ffffff',
  },
  dark: {
    edge: '#1f242a',
    seg: ['#2f353d', '#454c56'],
    ring: ['#5c6570', '#6f7883'],
    lit: '#3c89e8',
    litSoft: '#15417e',
    danger: '#dc4446',
    dotStroke: '#141414',
  },
} as const;
const EDGE = 196;

/**
 * Radii drawn, in mm out to the double's edge: the trebles, doubles and bull widened (as Ton
 * Up's Play button does) so they read at this size. Scoring still uses the real ones.
 */
const D = {
  innerBull: 12,
  outerBull: 26,
  trebleInner: 92,
  trebleOuter: 116,
  doubleInner: 146,
  doubleOuter: 170,
} as const;

type Ring = 'innerBull' | 'outerBull' | 'innerSingle' | 'treble' | 'outerSingle' | 'double';

/** Rings a scored label covers: "T20" → treble 20; "20" → both singles; "Bull" → the bull. */
export function regionsOf(label: string | null): { segment: number; rings: Ring[] } | null {
  if (!label) return null;
  if (label === 'Bull' || label === 'D25') return { segment: 25, rings: ['innerBull'] };
  if (label === '25') return { segment: 25, rings: ['outerBull'] };
  const m = /^([SDT]?)(\d{1,2})$/.exec(label);
  if (!m) return null;
  const segment = Number(m[2]);
  if (!SEGMENT_ORDER.includes(segment as (typeof SEGMENT_ORDER)[number])) return null;
  const rings: Ring[] =
    m[1] === 'T' ? ['treble'] : m[1] === 'D' ? ['double'] : ['innerSingle', 'outerSingle'];
  return { segment, rings };
}

const BANDS: Record<Exclude<Ring, 'innerBull' | 'outerBull'>, [number, number]> = {
  innerSingle: [D.outerBull, D.trebleInner],
  treble: [D.trebleInner, D.trebleOuter],
  outerSingle: [D.trebleOuter, D.doubleInner],
  double: [D.doubleInner, D.doubleOuter],
};

/** SVG coordinates: x right, y down (board y is up). */
const at = (r: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
};
const f = (n: number) => n.toFixed(2);

function wedge(r1: number, r2: number, from: number, to: number) {
  const a = at(r2, from);
  const b = at(r2, to);
  const c = at(r1, to);
  const d = at(r1, from);
  return `M${f(a.x)} ${f(a.y)}A${r2} ${r2} 0 0 1 ${f(b.x)} ${f(b.y)}L${f(c.x)} ${f(c.y)}A${r1} ${r1} 0 0 0 ${f(d.x)} ${f(d.y)}Z`;
}

/** The path of a region: one wedge per ring, or the bull's circle(s). */
function regionPath(region: { segment: number; rings: Ring[] }): string {
  return region.rings
    .map((ring) => {
      if (ring === 'innerBull' || ring === 'outerBull') {
        const r = ring === 'innerBull' ? D.innerBull : D.outerBull;
        return `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`;
      }
      const c = segmentCentreDegrees(region.segment);
      const [r1, r2] = BANDS[ring];
      return wedge(r1, r2, c - SEGMENT_DEGREES / 2, c + SEGMENT_DEGREES / 2);
    })
    .join('');
}

// The board itself never changes: drawn once.
const BASE = SEGMENT_ORDER.flatMap((_, i) => {
  const c = i * SEGMENT_DEGREES;
  const from = c - SEGMENT_DEGREES / 2;
  const to = c + SEGMENT_DEGREES / 2;
  return [
    { d: wedge(D.outerBull, D.doubleOuter, from, to), kind: 'seg' as const, alt: i % 2 },
    { d: wedge(D.trebleInner, D.trebleOuter, from, to), kind: 'ring' as const, alt: i % 2 },
    { d: wedge(D.doubleInner, D.doubleOuter, from, to), kind: 'ring' as const, alt: i % 2 },
  ];
});

export function MiniBoard({
  size = 32,
  lit,
  outlined,
  dot,
  title,
}: {
  size?: number;
  /** A board position in mm (scored exactly, ring and all) or a label ("T20", "5", "Bull"). */
  lit?: { x: number; y: number } | string | null;
  /** A label outlined in red: what was entered, when the tip scores something else. */
  outlined?: string | null;
  /** A board position in mm to mark. */
  dot?: { x: number; y: number } | null;
  title?: string;
}) {
  const c = PALETTES[useDark() ? 'dark' : 'light'];
  const litRegion =
    lit && typeof lit === 'object'
      ? (() => {
          const h = hitAt(lit);
          return h.ring === 'miss' ? null : { segment: h.segment, rings: [h.ring as Ring] };
        })()
      : regionsOf(lit ?? null);
  const outlinedRegion = regionsOf(outlined ?? null);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-EDGE} ${-EDGE} ${EDGE * 2} ${EDGE * 2}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{ flex: 'none', display: 'block' }}
    >
      <circle r={EDGE} fill={c.edge} />
      {BASE.map((w, i) => (
        <path key={i} d={w.d} fill={c[w.kind][w.alt]} />
      ))}
      <circle r={D.outerBull} fill={c.ring[1]} />
      <circle r={D.innerBull} fill={c.ring[0]} />
      {litRegion && litRegion.segment !== 25 ? (
        <path
          d={wedge(
            D.outerBull,
            D.doubleOuter,
            segmentCentreDegrees(litRegion.segment) - SEGMENT_DEGREES / 2,
            segmentCentreDegrees(litRegion.segment) + SEGMENT_DEGREES / 2,
          )}
          fill={c.litSoft}
        />
      ) : null}
      {litRegion ? <path d={regionPath(litRegion)} fill={c.lit} /> : null}
      {outlinedRegion ? (
        <path d={regionPath(outlinedRegion)} fill="none" stroke={c.danger} strokeWidth={14} />
      ) : null}
      {dot ? (
        <circle cx={dot.x} cy={-dot.y} r={26} fill={c.lit} stroke={c.dotStroke} strokeWidth={10} />
      ) : null}
    </svg>
  );
}
