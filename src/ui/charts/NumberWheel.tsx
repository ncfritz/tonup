import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';

import { SEGMENT_ORDER } from '@/domain/board';

import { ramp } from './colors';

const wedge = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) => {
  const p = (r: number, a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cy + r * Math.sin(t)).toFixed(2)}`;
  };
  return `M${p(r1, a0)}A${r1} ${r1} 0 0 1 ${p(r1, a1)}L${p(r0, a1)}A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`;
};

/**
 * The board's twenty numbers coloured by a rate per number (docs/design/stats.md → Number
 * wheel). `ring` draws only the double ring (the doubles view); `full` fills each number. A
 * number with no value is drawn empty.
 */
export function NumberWheel({
  size,
  levels,
  bull,
  texts,
  mode = 'full',
  center,
  accessibilityLabel,
}: {
  size: number;
  /** 0–1 per segment (1–20); null or missing for nothing to show. */
  levels: Partial<Record<number, number | null>>;
  bull?: number | null;
  /** A short figure in each number (darts needed). */
  texts?: Partial<Record<number, string>>;
  mode?: 'full' | 'ring';
  /** Drawn over the middle (the overall rate). */
  center?: ReactNode;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const c = size / 2;
  const outer = size / 2 - 22;
  const ringIn = mode === 'ring' ? outer - 22 : outer * 0.34;
  const innerFill = outer * 0.52;
  const empty = theme.colors.line;
  const fillFor = (v: number | null | undefined) =>
    v === null || v === undefined ? empty : ramp(theme, v);
  const inkFor = (v: number | null | undefined) =>
    v !== null && v !== undefined && v >= 0.6 ? theme.colors.onAccent : theme.colors.text;
  const font = theme.type.value.fontFamily;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size}>
        {mode === 'ring'
          ? SEGMENT_ORDER.map((n, i) => (
              <Path
                key={`i${n}`}
                d={wedge(c, c, innerFill, ringIn - 2, i * 18 - 9, i * 18 + 9)}
                fill={theme.colors.surface2}
                stroke={theme.colors.surface}
                strokeWidth={1.5}
              />
            ))
          : null}
        {SEGMENT_ORDER.map((n, i) => (
          <Path
            key={n}
            d={wedge(c, c, ringIn, outer, i * 18 - 9, i * 18 + 9)}
            fill={fillFor(levels[n])}
            stroke={theme.colors.surface}
            strokeWidth={1.5}
          />
        ))}
        {mode === 'full' ? (
          <Circle
            cx={c}
            cy={c}
            r={ringIn - 2}
            fill={fillFor(bull)}
            stroke={theme.colors.surface}
            strokeWidth={1.5}
          />
        ) : null}
        {SEGMENT_ORDER.map((n, i) => {
          const t = (((i * 18 - 90) * Math.PI) / 180) as number;
          const lr = outer + 12;
          return (
            <SvgText
              key={`n${n}`}
              x={c + lr * Math.cos(t)}
              y={c + lr * Math.sin(t) + 5}
              fontSize={14}
              fill={theme.colors.text}
              textAnchor="middle"
              fontFamily={font}
            >
              {String(n)}
            </SvgText>
          );
        })}
        {texts
          ? SEGMENT_ORDER.map((n, i) => {
              const s = texts[n];
              if (!s) return null;
              const t = ((i * 18 - 90) * Math.PI) / 180;
              const r = (outer + ringIn) / 2;
              return (
                <SvgText
                  key={`v${n}`}
                  x={c + r * Math.cos(t)}
                  y={c + r * Math.sin(t) + 4}
                  fontSize={12}
                  fill={inkFor(levels[n])}
                  textAnchor="middle"
                  fontFamily={theme.type.bodyStrong.fontFamily}
                >
                  {s}
                </SvgText>
              );
            })
          : null}
      </Svg>
      {center ? <View style={styles.center}>{center}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
