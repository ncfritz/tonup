import { View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { toneStyle, type SeriesTone } from './colors';

export interface LineSeries {
  /** One value per x position; null leaves a gap. */
  values: (number | null)[];
  tone: SeriesTone;
  /** Draw as steps (lives), not slopes. */
  step?: boolean;
}

/**
 * Lines over a shared x axis: the worm, a drill's trend, lives, skill levels. Plain
 * react-native-svg, no chart library (plan §1). Every series follows its tone's colour and dash,
 * so lines differ in more than hue.
 */
export function Lines({
  series,
  width,
  height = 170,
  min,
  max,
  ticks,
  format = (v) => String(Math.round(v)),
  xLabels,
  mark,
  reference,
  cursor,
  accessibilityLabel,
}: {
  series: LineSeries[];
  width: number;
  height?: number;
  min: number;
  max: number;
  /** Gridline values, labelled on the left. */
  ticks: number[];
  format?: (v: number) => string;
  /** Labels under the first and last points (and the middle, if given). */
  xLabels?: { start: string; end: string; mid?: string };
  /** A marked point: your best, a checkout. */
  mark?: { series: number; index: number; label: string };
  /** A dashed level line, from an x position to the end: the recent average. */
  reference?: { value: number; from?: number };
  /** Replay's scrubber: everything after this x position is drawn faint. */
  cursor?: number;
  accessibilityLabel: string;
}) {
  const { theme } = useUnistyles();
  const n = Math.max(0, ...series.map((s) => s.values.length));
  if (n === 0 || width <= 0) return <View style={{ height }} />;
  const left = 34;
  const right = width - 6;
  const top = 10;
  const bottom = height - (xLabels ? 24 : 8);
  const span = max - min || 1;
  const x = (i: number) => (n === 1 ? (left + right) / 2 : left + (i * (right - left)) / (n - 1));
  const y = (v: number) => bottom - ((v - min) / span) * (bottom - top);
  const font = theme.type.caption.fontFamily;

  const points = (values: (number | null)[], step: boolean, upTo = Infinity) => {
    const runs: string[][] = [[]];
    values.forEach((v, i) => {
      if (i > upTo) return;
      if (v === null) {
        runs.push([]);
        return;
      }
      const run = runs[runs.length - 1]!;
      const prev = values[i - 1];
      if (step && run.length && prev !== null && prev !== undefined) {
        run.push(`${x(i).toFixed(1)},${y(prev).toFixed(1)}`);
      }
      run.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    return runs.filter((r) => r.length > 1).map((r) => r.join(' '));
  };

  const marked = mark ? series[mark.series]?.values[mark.index] : null;
  return (
    <Svg width={width} height={height} accessible accessibilityLabel={accessibilityLabel}>
      {ticks.map((t) => (
        <Line
          key={`g${t}`}
          x1={left}
          x2={right}
          y1={y(t)}
          y2={y(t)}
          stroke={theme.colors.line}
          strokeWidth={1}
        />
      ))}
      {ticks.map((t) => (
        <SvgText
          key={`t${t}`}
          x={left - 6}
          y={y(t) + 4}
          fontSize={11}
          fill={theme.colors.muted}
          textAnchor="end"
          fontFamily={font}
        >
          {format(t)}
        </SvgText>
      ))}
      {xLabels ? (
        <>
          <SvgText
            x={left}
            y={height - 6}
            fontSize={11}
            fill={theme.colors.muted}
            fontFamily={font}
          >
            {xLabels.start}
          </SvgText>
          {xLabels.mid ? (
            <SvgText
              x={(left + right) / 2}
              y={height - 6}
              fontSize={11}
              fill={theme.colors.muted}
              textAnchor="middle"
              fontFamily={font}
            >
              {xLabels.mid}
            </SvgText>
          ) : null}
          <SvgText
            x={right}
            y={height - 6}
            fontSize={11}
            fill={theme.colors.muted}
            textAnchor="end"
            fontFamily={font}
          >
            {xLabels.end}
          </SvgText>
        </>
      ) : null}
      {reference ? (
        <Line
          x1={x(reference.from ?? 0)}
          x2={right}
          y1={y(reference.value)}
          y2={y(reference.value)}
          stroke={theme.colors.muted}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      ) : null}
      {cursor !== undefined
        ? series.flatMap((s, k) =>
            points(s.values, !!s.step).map((p, j) => (
              <Polyline
                key={`f${k}-${j}`}
                points={p}
                fill="none"
                stroke={theme.colors.line}
                strokeWidth={2}
              />
            )),
          )
        : null}
      {[...series]
        .map((s, k) => ({ s, k }))
        .reverse()
        .flatMap(({ s, k }) => {
          const st = toneStyle(theme, s.tone);
          return points(s.values, !!s.step, cursor).map((p, j) => (
            <Polyline
              key={`s${k}-${j}`}
              points={p}
              fill="none"
              stroke={st.color}
              strokeWidth={st.width}
              strokeDasharray={st.dash}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ));
        })}
      {cursor !== undefined ? (
        <>
          <Line
            x1={x(cursor)}
            x2={x(cursor)}
            y1={top - 4}
            y2={bottom + 4}
            stroke={theme.colors.text}
            strokeWidth={1.5}
          />
          {series.map((s, k) => {
            const v = s.values[cursor];
            if (v === null || v === undefined) return null;
            const st = toneStyle(theme, s.tone);
            return (
              <Circle
                key={`c${k}`}
                cx={x(cursor)}
                cy={y(v)}
                r={k === 0 ? 5 : 4.5}
                fill={s.tone === 'you' ? st.color : theme.colors.surface}
                stroke={st.color}
                strokeWidth={2}
              />
            );
          })}
        </>
      ) : null}
      {mark && marked !== null && marked !== undefined ? (
        <>
          <Circle
            cx={x(mark.index)}
            cy={y(marked)}
            r={6.5}
            fill={theme.colors.surface}
            stroke={theme.colors.accent}
            strokeWidth={2.5}
          />
          <SvgText
            x={Math.min(right - 30, Math.max(left + 30, x(mark.index)))}
            y={y(marked) < top + 24 ? y(marked) + 22 : y(marked) - 12}
            fontSize={12}
            fill={theme.colors.accent}
            textAnchor="middle"
            fontFamily={theme.type.bodyStrong.fontFamily}
          >
            {mark.label}
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}

/** Round, even gridlines for a range: [min, mid, max] snapped to a step. */
export function niceTicks(lo: number, hi: number): { min: number; max: number; ticks: number[] } {
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const raw = (hi - lo) / 2;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const min = Math.floor(lo / step) * step;
  const max = Math.max(min + step * 2, Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  return { min, max, ticks };
}
