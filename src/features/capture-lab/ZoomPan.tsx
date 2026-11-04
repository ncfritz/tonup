import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePinchGesture } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon, Pressable, Text } from '@/ui';

export const MAX_ZOOM = 6;
const STEP = 1.75;

export interface Zoom {
  s: number;
  x: number;
  y: number;
}

/**
 * Where content sits after zooming to `s` with the point under `focal` (both in the frame's
 * coordinates) kept under it: content is translated by (x, y) and scaled by s about the
 * frame's centre, and kept covering the frame.
 */
export function zoomAbout(
  from: Zoom,
  s: number,
  focal: { x: number; y: number },
  size: { w: number; h: number },
  focalNow = focal,
): Zoom {
  const scale = Math.min(MAX_ZOOM, Math.max(1, s));
  const cx = size.w / 2;
  const cy = size.h / 2;
  // The content point under the focal point, as an offset from the centre.
  const px = (focal.x - cx - from.x) / from.s;
  const py = (focal.y - cy - from.y) / from.s;
  return clampZoom(
    { s: scale, x: focalNow.x - cx - scale * px, y: focalNow.y - cy - scale * py },
    size,
  );
}

export function clampZoom(z: Zoom, size: { w: number; h: number }): Zoom {
  const mx = (size.w / 2) * (z.s - 1);
  const my = (size.h / 2) * (z.s - 1);
  return { s: z.s, x: Math.min(mx, Math.max(-mx, z.x)), y: Math.min(my, Math.max(-my, z.y)) };
}

/**
 * A frame its content can be zoomed in: pinch (about the fingers; moving them while pinching
 * moves the photo), or the buttons. One finger still reaches the content, so tapping and the magnifier
 * work as before; the content's own touch coordinates stay in its unzoomed space. `onZoom`
 * reports the scale once a gesture settles, so the content can keep its marks a steady size.
 */
export function ZoomPan({
  children,
  onZoom,
  testID,
}: {
  children: ReactNode;
  onZoom?: (scale: number) => void;
  testID?: string;
}) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [zoom, setZoomState] = useState<Zoom>({ s: 1, x: 0, y: 0 });
  const current = useRef(zoom);
  const start = useRef({ zoom, fx: 0, fy: 0 });

  const setZoom = (z: Zoom, settled = false) => {
    current.current = z;
    setZoomState(z);
    if (settled) onZoom?.(z.s);
  };

  const pinch = usePinchGesture({
    runOnJS: true,
    onActivate: (e) => {
      start.current = { zoom: current.current, fx: e.focalX, fy: e.focalY };
    },
    onUpdate: (e) => {
      const { zoom: z0, fx, fy } = start.current;
      setZoom(zoomAbout(z0, z0.s * e.scale, { x: fx, y: fy }, size, { x: e.focalX, y: e.focalY }));
    },
    onDeactivate: () => {
      setZoom(current.current, true);
    },
  });

  const centre = { x: size.w / 2, y: size.h / 2 };
  const by = (f: number) =>
    setZoom(zoomAbout(current.current, current.current.s * f, centre, size), true);

  return (
    <View
      style={styles.frame}
      onLayout={(e: LayoutChangeEvent) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
      testID={testID}
    >
      <GestureDetector gesture={pinch}>
        <View style={styles.fill}>
          <View
            style={{
              transform: [{ translateX: zoom.x }, { translateY: zoom.y }, { scale: zoom.s }],
            }}
          >
            {children}
          </View>
        </View>
      </GestureDetector>
      <View style={styles.controls}>
        {zoom.s > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('zoom.fit')}
            style={styles.button}
            onPress={() => setZoom({ s: 1, x: 0, y: 0 }, true)}
            testID="zoom-fit"
          >
            <Text variant="caption">{`${zoom.s.toFixed(1)}×`}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('zoom.out')}
          style={styles.button}
          disabled={zoom.s <= 1}
          onPress={() => by(1 / STEP)}
          testID="zoom-out"
        >
          <Icon name="minus" color={zoom.s <= 1 ? theme.colors.muted : theme.colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('zoom.in')}
          style={styles.button}
          disabled={zoom.s >= MAX_ZOOM}
          onPress={() => by(STEP)}
          testID="zoom-in"
        >
          <Icon name="plus" color={zoom.s >= MAX_ZOOM ? theme.colors.muted : theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  frame: { alignSelf: 'stretch', overflow: 'hidden', backgroundColor: theme.colors.bg },
  fill: { alignSelf: 'stretch' },
  controls: {
    position: 'absolute',
    right: theme.spacing.s,
    bottom: theme.spacing.s,
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  button: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: theme.spacing.s,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    opacity: 0.92,
  },
}));
