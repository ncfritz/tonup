import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View, type LayoutChangeEvent } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import { haptics } from '@/services/haptics';
import { Pressable, Text } from '@/ui';

/** The Delete chip's width; a half swipe opens to it. */
const CHIP = 92;
/** Past this share of the row's width, letting go deletes (as in Mail). */
export const FULL_SWIPE = 0.6;

/**
 * A History row that can be deleted (docs/design/screens.md → History tab), as in iOS Mail:
 * a half swipe left shows a Delete chip, which asks first; a full swipe deletes on release, and
 * History offers Undo. Holding the row, or VoiceOver's Delete action, also asks first.
 */
export function HistoryRow({
  label,
  name,
  inProgress,
  onOpen,
  onDelete,
  onFullSwipe,
  testID,
  children,
}: {
  label: string;
  /** What the confirm calls it: "501 · 3–1", "Bob's 27 · 112". */
  name: string;
  inProgress: boolean;
  onOpen: () => void;
  /** Deletes for good, after the confirm. */
  onDelete: () => void;
  /** A full swipe: deletes straight away, with Undo. */
  onFullSwipe: () => void;
  testID: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('history');
  const swipeable = useRef<SwipeableMethods>(null);
  const armed = useRef(false);
  const [width, setWidth] = useState(0);

  const confirm = () =>
    Alert.alert(
      t('delete.title'),
      inProgress ? t('delete.bodyInProgress', { name }) : t('delete.body', { name }),
      [
        { text: t('delete.cancel'), style: 'cancel', onPress: () => swipeable.current?.close() },
        { text: t('delete.confirm'), style: 'destructive', onPress: onDelete },
      ],
    );

  const onArm = (on: boolean) => {
    armed.current = on;
    // A tick as the row crosses the line, so you know letting go will delete.
    if (on) haptics.light();
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <Swipeable
        ref={swipeable}
        friction={1}
        rightThreshold={CHIP / 2}
        onSwipeableWillOpen={() => {
          if (armed.current) {
            armed.current = false;
            onFullSwipe();
          }
        }}
        renderRightActions={(_progress, translation) => (
          <DeleteActions
            translation={translation}
            fullAt={width * FULL_SWIPE}
            onArm={onArm}
            onPress={confirm}
            label={t('delete.action')}
            a11y={t('delete.a11y', { name })}
            testID={`${testID}-delete`}
          />
        )}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('delete.hint')}
          accessibilityActions={[{ name: 'delete', label: t('delete.action') }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'delete') confirm();
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          onPress={onOpen}
          onLongPress={confirm}
          testID={testID}
        >
          {children}
        </Pressable>
      </Swipeable>
    </View>
  );
}

/** The chip, and the red that follows the row past it on a long swipe. */
function DeleteActions({
  translation,
  fullAt,
  onArm,
  onPress,
  label,
  a11y,
  testID,
}: {
  translation: SharedValue<number>;
  fullAt: number;
  onArm: (on: boolean) => void;
  onPress: () => void;
  label: string;
  a11y: string;
  testID: string;
}) {
  useAnimatedReaction(
    () => fullAt > 0 && -translation.value > fullAt,
    (on, was) => {
      if (on !== was && was !== null) scheduleOnRN(onArm, on);
    },
    [fullAt],
  );
  const fill = useAnimatedStyle(() => ({
    width: Math.max(0, -translation.value - CHIP),
  }));
  return (
    <View style={styles.actions}>
      <Animated.View style={[styles.fill, fill]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        onPress={onPress}
        testID={testID}
      >
        <Text variant="bodyStrong" tone="onDanger">
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
  },
  actions: { width: CHIP, flexDirection: 'row' },
  chip: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.danger,
    borderTopRightRadius: theme.radii.m,
    borderBottomRightRadius: theme.radii.m,
  },
  // Sits left of the chip, outside its measured width, so the chip's width stays fixed.
  fill: {
    position: 'absolute',
    right: CHIP,
    top: 0,
    bottom: 0,
    backgroundColor: theme.colors.danger,
  },
  pressed: { opacity: 0.85 },
}));
