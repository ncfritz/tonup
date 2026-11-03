import { memo, useMemo, useRef, useState } from 'react';
import { View, type GestureResponderEvent } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';

import {
  hitAt,
  polar,
  SEGMENT_ORDER,
  segmentCentreDegrees,
  STEEL_TIP_RADII_MM as R,
} from '@/domain/board';
import { BULL, label, type Point, type Ring, type Target } from '@/domain/darts';
import { parseRegion, type Heat } from '@/domain/stats';

import { ringWedges, wedgePath } from './boardPaths';
import { Text } from './Text';

/** Board space in the drawing: ±200 mm around the bull, the number ring at 185 mm. */
const HALF = 200;
const NUMBER_RADIUS = 185;
/** How many millimetres the loupe shows across, and its size on screen. */
const LOUPE_SPAN_MM = 48;
const LOUPE = 128;
/** The loupe sits this far above the finger so the finger doesn't hide it. */
const LOUPE_LIFT = 96;
/** A touch held this long, or moved this far, shows the loupe. */
const LOUPE_DELAY_MS = 140;
const LOUPE_MOVE_PT = 4;

export interface BoardMarker {
  point: Point;
  /** Shown inside the marker: the dart number in the visit, usually. */
  text: string;
  /** A faded marker, for darts from earlier visits. */
  faded?: boolean;
}

/** Board space (mm, y up) to the drawing (y down). */
const svgY = (p: Point) => -p.y;

const BoardArt = memo(function BoardArt() {
  const { theme } = useUnistyles();
  const c = theme.colors;
  const rings = useMemo(
    () => ({
      inner: ringWedges(0, 0, R.outerBull, R.trebleInner),
      treble: ringWedges(0, 0, R.trebleInner, R.trebleOuter),
      outer: ringWedges(0, 0, R.trebleOuter, R.doubleInner),
      double: ringWedges(0, 0, R.doubleInner, R.doubleOuter),
    }),
    [],
  );
  return (
    <G>
      <Circle cx={0} cy={0} r={HALF} fill={c.boardSurround} />
      {rings.inner.map((w) => (
        <Path key={`i${w.segment}`} d={w.d} fill={w.alt ? c.boardDark : c.boardLight} />
      ))}
      {rings.outer.map((w) => (
        <Path key={`o${w.segment}`} d={w.d} fill={w.alt ? c.boardDark : c.boardLight} />
      ))}
      {rings.treble.map((w) => (
        <Path key={`t${w.segment}`} d={w.d} fill={w.alt ? c.boardRed : c.boardGreen} />
      ))}
      {rings.double.map((w) => (
        <Path key={`d${w.segment}`} d={w.d} fill={w.alt ? c.boardRed : c.boardGreen} />
      ))}
      <Circle cx={0} cy={0} r={R.outerBull} fill={c.boardGreen} />
      <Circle cx={0} cy={0} r={R.innerBull} fill={c.boardRed} />
      {SEGMENT_ORDER.map((s) => {
        const p = polar(NUMBER_RADIUS, segmentCentreDegrees(s));
        return (
          <SvgText
            key={`n${s}`}
            x={p.x}
            y={-p.y + 7}
            fontSize={20}
            fontWeight="700"
            fontFamily={theme.type.title.fontFamily}
            fill={c.boardNumber}
            textAnchor="middle"
          >
            {s}
          </SvgText>
        );
      })}
    </G>
  );
});

function Markers({
  markers,
  scale,
  radius = 10,
}: {
  markers: BoardMarker[];
  scale: number;
  radius?: number;
}) {
  const { theme } = useUnistyles();
  // Markers keep their size on screen whatever the board's size.
  const r = radius / scale;
  return (
    <G>
      {markers.map((m, i) => (
        <G key={i} opacity={m.faded ? 0.45 : 1}>
          {theme.look.marker === 'glow' ? (
            <Circle
              cx={m.point.x}
              cy={svgY(m.point)}
              r={r * 1.8}
              fill="none"
              stroke={theme.colors.dart}
              strokeWidth={2 / scale}
              opacity={0.6}
            />
          ) : null}
          <Circle
            cx={m.point.x}
            cy={svgY(m.point)}
            r={r}
            fill={theme.colors.dart}
            stroke={theme.colors.dartStroke}
            strokeWidth={theme.look.markerStroke / scale}
          />
          <SvgText
            x={m.point.x}
            y={svgY(m.point) + r * 0.42}
            fontSize={r * 1.25}
            fontWeight="800"
            fontFamily={theme.type.heading.fontFamily}
            fill={theme.colors.dartStroke}
            textAnchor="middle"
          >
            {m.text}
          </SvgText>
        </G>
      ))}
    </G>
  );
}

/** An outline around a target's area: the drill's double, the next number. */
function Highlight({ target, scale }: { target: Target; scale: number }) {
  const { theme } = useUnistyles();
  const stroke = { stroke: theme.colors.accent, strokeWidth: 3 / scale, fill: 'none' } as const;
  if (target.segment === BULL) {
    return (
      <Circle cx={0} cy={0} r={target.multiplier === 2 ? R.innerBull : R.outerBull} {...stroke} />
    );
  }
  const deg = segmentCentreDegrees(target.segment);
  const [r1, r2] =
    target.multiplier === 3
      ? [R.trebleInner, R.trebleOuter]
      : target.multiplier === 2
        ? [R.doubleInner, R.doubleOuter]
        : [R.outerBull, R.doubleInner];
  return <Path d={wedgePath(0, 0, r1, r2, deg - 9, deg + 9)} {...stroke} />;
}

const RING_RADII: Partial<Record<Ring, [number, number]>> = {
  innerSingle: [R.outerBull, R.trebleInner],
  treble: [R.trebleInner, R.trebleOuter],
  outerSingle: [R.trebleOuter, R.doubleInner],
  double: [R.doubleInner, R.doubleOuter],
  outerBull: [R.innerBull, R.outerBull],
};

/** Regions shaded by how many darts landed there. */
function HeatLayer({ heat }: { heat: Heat[] }) {
  const { theme } = useUnistyles();
  return (
    <G>
      {heat.map((h) => {
        const r = parseRegion(h.region);
        if (!r) return null;
        const opacity = 0.18 + 0.72 * h.intensity;
        if (r.ring === 'innerBull') {
          return (
            <Circle
              key={h.region}
              cx={0}
              cy={0}
              r={R.innerBull}
              fill={theme.colors.accent}
              opacity={opacity}
            />
          );
        }
        const radii = RING_RADII[r.ring];
        if (!radii) return null;
        const d =
          r.ring === 'outerBull'
            ? `${wedgePath(0, 0, radii[0], radii[1], 0, 180)} ${wedgePath(0, 0, radii[0], radii[1], 180, 360)}`
            : (() => {
                const deg = segmentCentreDegrees(r.segment);
                return wedgePath(0, 0, radii[0], radii[1], deg - 9, deg + 9);
              })();
        return <Path key={h.region} d={d} fill={theme.colors.accent} opacity={opacity} />;
      })}
    </G>
  );
}

/**
 * The dartboard, drawn in board millimetres. With `onDart`, tap where a dart landed; hold and
 * drag to place it precisely with the loupe, then let go (docs/design/screens.md → Scoring).
 */
export function Board({
  size,
  markers = [],
  onDart,
  muted = false,
  markerRadius,
  highlight,
  heat,
  accessibilityLabel,
  accessibilityHint,
}: {
  size: number;
  markers?: BoardMarker[];
  onDart?: (point: Point) => void;
  /** Dimmed, so markers stand out (replay, heatmaps, previews). */
  muted?: boolean;
  /** Marker radius in points (default 10). */
  markerRadius?: number;
  /** Outline this target (drills). */
  highlight?: Target | null;
  /** Shade regions by dart count (the History heatmap). */
  heat?: Heat[];
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  const { theme } = useUnistyles();
  const scale = size / (HALF * 2);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);
  const [loupe, setLoupe] = useState(false);
  const start = useRef<{ x: number; y: number; timer?: ReturnType<typeof setTimeout> } | null>(
    null,
  );

  const toBoard = (x: number, y: number): Point => ({
    x: x / scale - HALF,
    y: HALF - y / scale,
  });

  // The latest touch, read on release (state may not have re-rendered yet).
  const latest = useRef<{ x: number; y: number } | null>(null);
  const place = (x: number, y: number) => {
    latest.current = { x, y };
    setTouch({ x, y });
  };
  const begin = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    const timer = setTimeout(() => setLoupe(true), LOUPE_DELAY_MS);
    start.current = { x, y, timer };
    place(x, y);
  };
  const move = (e: GestureResponderEvent) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    const s = start.current;
    if (s && Math.hypot(x - s.x, y - s.y) > LOUPE_MOVE_PT) setLoupe(true);
    place(x, y);
  };
  const end = (commit: boolean) => {
    if (start.current?.timer) clearTimeout(start.current.timer);
    const at = latest.current;
    if (commit && at) onDart?.(toBoard(at.x, at.y));
    start.current = null;
    latest.current = null;
    setTouch(null);
    setLoupe(false);
  };

  const aim = touch ? toBoard(touch.x, touch.y) : null;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole={onDart ? 'adjustable' : 'image'}
      pointerEvents={onDart ? 'auto' : 'none'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onStartShouldSetResponder={() => !!onDart}
      onMoveShouldSetResponder={() => !!onDart}
      onResponderGrant={begin}
      onResponderMove={move}
      onResponderRelease={() => end(true)}
      onResponderTerminate={() => end(false)}
      testID="board"
    >
      <Svg
        width={size}
        height={size}
        viewBox={`${-HALF} ${-HALF} ${HALF * 2} ${HALF * 2}`}
        pointerEvents="none"
      >
        <BoardArt />
        {muted ? <Circle cx={0} cy={0} r={HALF} fill={theme.colors.bg} opacity={0.55} /> : null}
        {heat ? <HeatLayer heat={heat} /> : null}
        {highlight ? <Highlight target={highlight} scale={scale} /> : null}
        <Markers markers={markers} scale={scale} radius={markerRadius} />
      </Svg>
      {loupe && touch && aim ? (
        <View
          pointerEvents="none"
          style={[
            styles.loupe,
            { left: touch.x - LOUPE / 2, top: touch.y - LOUPE_LIFT - LOUPE / 2 },
          ]}
        >
          <Svg
            width={LOUPE}
            height={LOUPE}
            viewBox={`${aim.x - LOUPE_SPAN_MM / 2} ${-aim.y - LOUPE_SPAN_MM / 2} ${LOUPE_SPAN_MM} ${LOUPE_SPAN_MM}`}
          >
            <BoardArt />
            <Markers markers={markers} scale={LOUPE / LOUPE_SPAN_MM} />
            <Line
              x1={aim.x - 4}
              x2={aim.x + 4}
              y1={-aim.y}
              y2={-aim.y}
              stroke={theme.colors.dart}
              strokeWidth={0.6}
            />
            <Line
              x1={aim.x}
              x2={aim.x}
              y1={-aim.y - 4}
              y2={-aim.y + 4}
              stroke={theme.colors.dart}
              strokeWidth={0.6}
            />
          </Svg>
          <View style={styles.loupeLabel}>
            <Text variant="value" tone="onAccent">
              {label(hitAt(aim))}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  loupe: {
    position: 'absolute',
    width: LOUPE,
    height: LOUPE,
    borderRadius: LOUPE / 2,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.bg,
  },
  loupeLabel: {
    position: 'absolute',
    bottom: 6,
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.s,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.accent,
  },
}));
