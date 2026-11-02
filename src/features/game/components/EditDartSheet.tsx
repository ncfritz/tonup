import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { label, miss, type DartEvent, type Hit } from '@/domain/darts';
import { Button, Keypad, Text } from '@/ui';

import { previewEdit } from '../session';
import { useGame } from '../store';

/** Change one dart with the keypad; warns first if later darts would be removed. */
export function EditDartSheet({
  dart,
  number,
  onClose,
}: {
  dart: DartEvent | null;
  number: number;
  onClose: () => void;
}) {
  const { t } = useTranslation('game');
  const [pending, setPending] = useState<{ hit: Hit; dropped: number } | null>(null);
  const close = () => {
    setPending(null);
    onClose();
  };
  const choose = (hit: Hit) => {
    const game = useGame.getState().game;
    if (!game || !dart) return;
    const change = { hit, point: null, source: 'keypad' as const };
    const dropped = previewEdit(game, dart.seq, change);
    if (dropped > 0) {
      setPending({ hit, dropped });
      return;
    }
    useGame.getState().edit(dart.seq, change);
    close();
  };
  const confirm = () => {
    if (!pending || !dart) return;
    useGame.getState().edit(dart.seq, { hit: pending.hit, point: null, source: 'keypad' });
    close();
  };
  return (
    <Modal
      visible={!!dart}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <Text variant="title" accessibilityRole="header">
          {t('edit.title', { n: number })}
        </Text>
        {dart ? <Text tone="muted">{t('edit.current', { dart: label(dart.hit) })}</Text> : null}
        {pending ? (
          <View style={styles.warn}>
            <Text>{t('edit.dropWarning', { count: pending.dropped })}</Text>
            <Button label={t('edit.confirm')} onPress={confirm} />
            <Button kind="secondary" label={t('edit.cancel')} onPress={() => setPending(null)} />
          </View>
        ) : (
          <>
            <View style={styles.keypad}>
              <Keypad onHit={choose} />
            </View>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button kind="secondary" label={t('edit.missKey')} onPress={() => choose(miss())} />
              </View>
              <View style={styles.flex}>
                <Button kind="secondary" label={t('edit.cancel')} onPress={close} />
              </View>
            </View>
          </>
        )}
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
  keypad: { height: 330 },
  warn: { gap: theme.spacing.m },
  row: { flexDirection: 'row', gap: theme.spacing.s },
  flex: { flex: 1 },
}));
