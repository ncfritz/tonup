import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { mix, type SeriesTone } from './colors';

/**
 * Grouped bars: the visit histogram (bands across, a bar per player) and round bars (rounds
 * across). Counts can sit on top of the bars when there's room.
 */
export function Bars({
  groups,
  tones,
  width,
  height = 150,
  reference,
  showValues = true,
  accessibilityLabel,
}: {
  groups: { label: string; values: number[] }[];
  tones: SeriesTone[];
  width: number;
  height?: number;
  /** A dashed level line, labelled by the caller (3 marks a round). */
  reference?: number;
  showValues?: boolean;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  if (groups.length === 0 || width <= 0) return <View style={{ height }} />;
  const bottom = height - 18;
  const top = showValues ? 16 : 4;
  const max = Math.max(1, reference ?? 0, ...groups.flatMap((g) => g.values));
  const slot = width / groups.length;
  const k = Math.max(1, tones.length);
  const bar = Math.max(3, Math.min(16, (slot - 6) / k - 2));
  const font = theme.type.caption.fontFamily;
  const fill = (tone: SeriesTone) =>
    tone === 'you'
      ? theme.colors.accent
      : tone === 'other'
        ? mix(theme.colors.muted, theme.colors.line, 0.25)
        : tone === 'third'
          ? mix(theme.colors.muted, theme.colors.line, 0.6)
          : mix(theme.colors.muted, theme.colors.text, 0.4);
  const h = (v: number) => Math.max(v > 0 ? 2 : 0, (v / max) * (bottom - top));
  const labelEvery = Math.ceil(groups.length / 12);
  return (
    <Svg width={width} height={height} accessible accessibilityLabel={accessibilityLabel}>
      <Line x1={0} x2={width} y1={bottom} y2={bottom} stroke={theme.colors.line} strokeWidth={1} />
      {groups.map((g, gi) => {
        const total = k * bar + (k - 1) * 2;
        const x0 = gi * slot + (slot - total) / 2;
        return (
          <G key={gi}>
            {g.values.map((v, i) => (
              <Rect
                key={i}
                x={x0 + i * (bar + 2)}
                y={bottom - h(v)}
                width={bar}
                height={h(v)}
                rx={2}
                fill={fill(tones[i] ?? 'other')}
              />
            ))}
            {showValues && bar >= 8
              ? g.values.map((v, i) => (
                  <SvgText
                    key={`v${i}`}
                    x={x0 + i * (bar + 2) + bar / 2}
                    y={bottom - h(v) - 4}
                    fontSize={10}
                    fill={tones[i] === 'you' ? theme.colors.accent : theme.colors.muted}
                    textAnchor="middle"
                    fontFamily={font}
                  >
                    {String(v)}
                  </SvgText>
                ))
              : null}
            {gi % labelEvery === 0 ? (
              <SvgText
                x={gi * slot + slot / 2}
                y={height - 4}
                fontSize={11}
                fill={theme.colors.muted}
                textAnchor="middle"
                fontFamily={font}
              >
                {g.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}
      {reference !== undefined ? (
        <Line
          x1={0}
          x2={width}
          y1={bottom - h(reference)}
          y2={bottom - h(reference)}
          stroke={theme.colors.muted}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : null}
    </Svg>
  );
}
