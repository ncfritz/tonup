import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BULL, hitOf, type Hit } from '@/domain/darts';
import { haptics } from '@/services/haptics';

import { Pressable } from './Pressable';
import { Text } from './Text';

const NUMBERS = Array.from({ length: 20 }, (_, i) => i + 1);

/**
 * Score entry without the board: pick Single, Double or Treble, then the number; the ring goes
 * back to Single after each dart. The bulls have their own keys.
 */
export function Keypad({ onHit, disabled }: { onHit: (hit: Hit) => void; disabled?: boolean }) {
  const { t } = useTranslation('game');
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const enter = (hit: Hit) => {
    haptics.light();
    onHit(hit);
    setMult(1);
  };
  const rings = [
    { m: 1 as const, label: t('keypad.single') },
    { m: 2 as const, label: t('keypad.double') },
    { m: 3 as const, label: t('keypad.treble') },
  ];
  return (
    <View style={styles.wrap}>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('keypad.ring')} style={styles.row}>
        {rings.map((r) => {
          const on = r.m === mult;
          return (
            <Pressable
              key={r.m}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[styles.ring, on && styles.ringOn]}
              onPress={() => setMult(r.m)}
            >
              <Text variant="bodyStrong" tone={on ? 'onAccent' : 'text'}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.grid}>
        {NUMBERS.map((n) => {
          const name = mult === 3 ? `T${n}` : mult === 2 ? `D${n}` : `${n}`;
          return (
            <Pressable
              key={n}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={name}
              testID={`key-${name}`}
              style={({ pressed }) => [styles.key, pressed && styles.pressed]}
              onPress={() => enter(hitOf(n, mult))}
            >
              <Text variant="title">{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          testID="key-25"
          style={({ pressed }) => [styles.bull, pressed && styles.pressed]}
          onPress={() => enter(hitOf(BULL, 1))}
        >
          <Text variant="bodyStrong">{t('keypad.outerBull')}</Text>
        </Pressable>
        <Pressable
          disabled={disabled}
          accessibilityRole="button"
          testID="key-Bull"
          style={({ pressed }) => [styles.bull, pressed && styles.pressed]}
          onPress={() => enter(hitOf(BULL, 2))}
        >
          <Text variant="bodyStrong">{t('keypad.bull')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flex: 1, gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  ring: {
    flex: 1,
    height: 44,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOn: { backgroundColor: theme.colors.accent },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  key: {
    flexBasis: '18%',
    flexGrow: 1,
    minHeight: 44,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bull: {
    flex: 1,
    height: 48,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
}));
