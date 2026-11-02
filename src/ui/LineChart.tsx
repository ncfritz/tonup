import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

/**
 * A small trend line (History): points in order, the last one marked, three gridlines with
 * their values. Drawn with react-native-svg, no chart library (plan §1).
 */
export function LineChart({
  values,
  width,
  height = 110,
  accessibilityLabel,
}: {
  values: number[];
  width: number;
  height?: number;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  if (values.length === 0 || width <= 0) return <View style={{ height }} />;
  const left = 30;
  const top = 12;
  const bottom = height - 14;
  const right = width - 8;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const y = (v: number) => bottom - ((v - min) / (max - min)) * (bottom - top);
  const x = (i: number) =>
    values.length === 1 ? (left + right) / 2 : left + (i * (right - left)) / (values.length - 1);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid = [max, (max + min) / 2, min];
  const fmt = (v: number) =>
    Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(Number.isInteger(v) ? 0 : 1);
  const last = values.length - 1;
  return (
    <Svg width={width} height={height} accessible accessibilityLabel={accessibilityLabel}>
      {grid.map((g, i) => (
        <Line
          key={i}
          x1={left}
          x2={right}
          y1={y(g)}
          y2={y(g)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
      ))}
      {grid.map((g, i) => (
        <SvgText
          key={`t${i}`}
          x={left - 6}
          y={y(g) + 4}
          fontSize={11}
          fill={theme.colors.muted}
          textAnchor="end"
          fontFamily={theme.type.caption.fontFamily}
        >
          {fmt(g)}
        </SvgText>
      ))}
      {values.length > 1 ? (
        <Polyline
          points={pts}
          fill="none"
          stroke={theme.colors.accent}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <Circle
        cx={x(last)}
        cy={y(values[last]!)}
        r={5.5}
        fill={theme.colors.accent}
        stroke={theme.colors.surface}
        strokeWidth={2}
      />
    </Svg>
  );
}
