import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { label, type DartEvent } from '@/domain/darts';
import { Button, Pressable, Text } from '@/ui';

import { useGame } from '../store';

/** Every visit of the current leg; tap a dart to change it. */
export function VisitsSheet({
  visible,
  onClose,
  onEdit,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: (dart: DartEvent, number: number) => void;
}) {
  const { t } = useTranslation('game');
  const game = useGame((s) => s.game);
  const state = game?.state;
  const leg = state ? (state.visits[state.visits.length - 1]?.leg ?? state.leg) : 0;
  const visits = state ? state.visits.filter((v) => v.leg === leg) : [];
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <Text variant="title" accessibilityRole="header">
          {t('edit.visitsTitle')}
        </Text>
        <ScrollView contentContainerStyle={styles.list}>
          {[...visits].reverse().map((v) => {
            const player = state!.players[v.player]!;
            return (
              <View key={v.darts[0]!.id} style={styles.visit}>
                <Text variant="bodyStrong" style={styles.name} numberOfLines={1}>
                  {player.name}
                </Text>
                {v.darts.map((d, i) => (
                  <Pressable
                    key={d.id}
                    accessibilityRole="button"
                    accessibilityLabel={t('slots.dartA11y', { n: i + 1, dart: label(d.hit) })}
                    accessibilityHint={t('slots.editHint')}
                    style={styles.dart}
                    onPress={() => onEdit(d, i + 1)}
                  >
                    <Text variant="value">{label(d.hit)}</Text>
                  </Pressable>
                ))}
                <Text variant="value" tone={v.bust ? 'danger' : 'accent'} style={styles.total}>
                  {v.bust ? t('slots.bust') : v.scored}
                </Text>
              </View>
            );
          })}
        </ScrollView>
        <Button kind="secondary" label={t('edit.close')} onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.l,
    gap: theme.spacing.m,
  },
  list: { gap: theme.spacing.s },
  visit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.s,
  },
  name: { flex: 1 },
  dart: {
    minWidth: 56,
    height: 40,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  total: { width: 52, textAlign: 'right' },
}));
