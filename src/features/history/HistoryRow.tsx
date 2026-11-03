import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet } from 'react-native-unistyles';

import { Pressable, Text } from '@/ui';

/**
 * A History row that can be deleted (docs/design/screens.md → History tab): swipe left for a
 * Delete button, or hold the row; VoiceOver offers Delete as an action. Either way a confirm
 * comes first, since a deleted game can't be brought back.
 */
export function HistoryRow({
  label,
  name,
  inProgress,
  onOpen,
  onDelete,
  testID,
  children,
}: {
  label: string;
  /** What the confirm calls it: "501 vs DartBot 3", "Bob's 27". */
  name: string;
  inProgress: boolean;
  onOpen: () => void;
  onDelete: () => void;
  testID: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('history');
  const confirm = (close?: () => void) =>
    Alert.alert(
      t('delete.title'),
      inProgress ? t('delete.bodyInProgress', { name }) : t('delete.body', { name }),
      [
        { text: t('delete.cancel'), style: 'cancel', onPress: close },
        { text: t('delete.confirm'), style: 'destructive', onPress: onDelete },
      ],
    );
  return (
    <Swipeable
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={(_p, _t, swipeable) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('delete.a11y', { name })}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          onPress={() => confirm(() => swipeable.close())}
          testID={`${testID}-delete`}
        >
          <Text variant="bodyStrong" tone="onDanger">
            {t('delete.action')}
          </Text>
        </Pressable>
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
        onLongPress={() => confirm()}
        testID={testID}
      >
        {children}
      </Pressable>
    </Swipeable>
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
  action: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginLeft: theme.spacing.s,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.danger,
  },
  pressed: { opacity: 0.85 },
}));
