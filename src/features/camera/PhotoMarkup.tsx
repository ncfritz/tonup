import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { STEEL_TIP_RADII_MM as R, polar } from '@/domain/board';
import {
  applyHomography,
  CALIBRATION_IDS,
  type BoardFit,
  type CalibrationId,
  type ImagePoint,
} from '@/domain/camera';

import type { Photo } from './snap';

/** A dart drawn on the photo: where, its number, and whether it needs a look. */
export interface MarkupDart {
  image: ImagePoint;
  n: number;
  flagged: boolean;
}

/** The loupe's size, how much it magnifies, and how far above the finger it sits. */
const LOUPE = 120;
const ZOOM = 3;
const LIFT = 90;
/** A tap this close to a marker selects it. */
const HIT_PT = 22;

/**
 * The photo with what was read drawn on it: the board's rings as found, the calibration points,
 * and numbered darts. Touch shows a magnifier; letting go marks, adds, selects or moves. Used by
 * snap to score and by Ton Up Capture's labelling.
 */
export function PhotoMarkup({
  photo,
  fit,
  calibration,
  darts,
  selected,
  selectNear,
  onTap,
  onSelect,
  scale = 1,
  onPhotoError,
}: {
  /** With no `uri` (the photo's gone), the markup is drawn on a blank the photo's shape. */
  photo: Omit<Photo, 'uri'> & { uri: string | null };
  fit: BoardFit | null;
  calibration: Partial<Record<CalibrationId, ImagePoint>>;
  darts: MarkupDart[];
  /** Index into `darts` of the one being moved. */
  selected: number | null;
  /** A tap near a dart selects it instead of passing the tap on. */
  selectNear: boolean;
  onTap: (p: ImagePoint) => void;
  onSelect: (i: number) => void;
  /** How far the photo is zoomed (ZoomPan): marks and the magnifier keep their size on screen. */
  scale?: number;
  /** The photo couldn't be loaded (one from Lab, say): the caller can fall back to a blank. */
  onPhotoError?: () => void;
}) {
  const { t } = useTranslation('game');
  const { theme } = useUnistyles();
  const [w, setW] = useState(0);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);
  const h = w * (photo.height / photo.width);
  const toPx = (p: ImagePoint) => ({ x: p.x * w, y: p.y * h });
  // Sizes in the photo's own (unzoomed) points that come out the same on screen at any zoom.
  const k = 1 / scale;
  const loupe = LOUPE * k;

  const at = (e: GestureResponderEvent) => ({
    x: Math.min(w, Math.max(0, e.nativeEvent.locationX)),
    y: Math.min(h, Math.max(0, e.nativeEvent.locationY)),
  });
  const release = (e: GestureResponderEvent) => {
    const p = at(e);
    setTouch(null);
    const image = { x: p.x / w, y: p.y / h };
    if (selectNear) {
      const near = darts
        .map((d, i) => ({ i, d: Math.hypot(toPx(d.image).x - p.x, toPx(d.image).y - p.y) }))
        .filter((n) => n.d < HIT_PT * k)
        .sort((a, b) => a.d - b.d)[0];
      if (near) {
        onSelect(near.i);
        return;
      }
    }
    onTap(image);
  };

  // The double and treble rings as the fit sees them, drawn back onto the photo.
  const ring = (r: number) =>
    fit
      ? Array.from({ length: 73 }, (_, i) => toPx(applyHomography(fit.toImage, polar(r, i * 5))))
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(' ')
      : '';

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={styles.wrap}
      testID="snap-photo-frame"
    >
      {w > 0 ? (
        <View
          style={{ width: w, height: h }}
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('snap.photoA11y', { count: darts.length })}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => setTouch(at(e))}
          onResponderMove={(e) => setTouch(at(e))}
          onResponderRelease={release}
          onResponderTerminate={() => setTouch(null)}
          testID="snap-photo"
        >
          {photo.uri ? (
            <Image
              source={{ uri: photo.uri }}
              style={{ width: w, height: h }}
              onError={onPhotoError}
              testID="snap-photo-image"
            />
          ) : (
            <View style={[styles.blank, { width: w, height: h }]} testID="snap-photo-blank" />
          )}
          <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
            {fit ? (
              <>
                <Polyline
                  points={ring(R.doubleOuter)}
                  fill="none"
                  stroke={theme.colors.accent}
                  strokeWidth={1.5 * k}
                />
                <Polyline
                  points={ring(R.trebleOuter)}
                  fill="none"
                  stroke={theme.colors.accent}
                  strokeWidth={k}
                />
                <Polyline
                  points={ring(R.outerBull)}
                  fill="none"
                  stroke={theme.colors.accent}
                  strokeWidth={k}
                />
              </>
            ) : null}
            {CALIBRATION_IDS.map((id) => {
              const p = calibration[id];
              if (!p) return null;
              const q = toPx(p);
              return (
                <Circle
                  key={id}
                  cx={q.x}
                  cy={q.y}
                  r={5 * k}
                  fill="none"
                  stroke={theme.colors.accent}
                  strokeWidth={2 * k}
                />
              );
            })}
            {darts.map((d, i) => {
              const q = toPx(d.image);
              const sel = selected === i;
              return (
                <Circle
                  key={`d${i}`}
                  cx={q.x}
                  cy={q.y}
                  r={(sel ? 14 : 11) * k}
                  fill={theme.colors.dart}
                  stroke={d.flagged ? theme.colors.danger : theme.colors.dartStroke}
                  strokeWidth={(sel ? 4 : 2.5) * k}
                />
              );
            })}
            {darts.map((d, i) => {
              const q = toPx(d.image);
              return (
                <SvgText
                  key={`n${i}`}
                  x={q.x}
                  y={q.y + 4.5 * k}
                  fontSize={13 * k}
                  fontWeight="800"
                  fill={theme.colors.dartStroke}
                  textAnchor="middle"
                >
                  {d.n}
                </SvgText>
              );
            })}
          </Svg>
          {touch ? (
            <View
              pointerEvents="none"
              style={[
                styles.loupe,
                {
                  width: loupe,
                  height: loupe,
                  borderRadius: loupe / 2,
                  borderWidth: 3 * k,
                  left: touch.x - loupe / 2,
                  top: Math.max(0, touch.y - (LIFT + LOUPE / 2) * k),
                },
              ]}
            >
              {photo.uri ? (
                <Image
                  source={{ uri: photo.uri }}
                  style={{
                    position: 'absolute',
                    width: w * ZOOM,
                    height: h * ZOOM,
                    left: loupe / 2 - touch.x * ZOOM,
                    top: loupe / 2 - touch.y * ZOOM,
                  }}
                />
              ) : null}
              <Svg width={loupe} height={loupe} style={StyleSheet.absoluteFill}>
                <Line
                  x1={loupe / 2 - 10 * k}
                  x2={loupe / 2 + 10 * k}
                  y1={loupe / 2}
                  y2={loupe / 2}
                  stroke={theme.colors.accent}
                  strokeWidth={1.5 * k}
                />
                <Line
                  x1={loupe / 2}
                  x2={loupe / 2}
                  y1={loupe / 2 - 10 * k}
                  y2={loupe / 2 + 10 * k}
                  stroke={theme.colors.accent}
                  strokeWidth={1.5 * k}
                />
              </Svg>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { alignSelf: 'stretch', borderRadius: theme.radii.m, overflow: 'hidden' },
  blank: { backgroundColor: theme.colors.surface2 },
  loupe: {
    position: 'absolute',
    overflow: 'hidden',
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.bg,
  },
}));
