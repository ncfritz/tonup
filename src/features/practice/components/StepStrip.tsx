import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { DrillStep } from '@/domain/drills';
import { Text } from '@/ui';

/** The drill's progress: one cell per round, coloured by how it went. */
export function StepStrip({ steps }: { steps: DrillStep[] }) {
  const { t } = useTranslation('practice');
  return (
    <View style={styles.row} accessibilityLabel={t('drill.stepsA11y')}>
      {steps.map((s, i) => (
        <View
          key={i}
          style={[styles.cell, styles[s.state]]}
          accessible
          accessibilityLabel={t('drill.stepA11y', { label: s.label, state: s.state })}
        >
          {steps.length <= 12 ? (
            <Text variant="caption" tone={s.state === 'done' ? 'onAccent' : 'muted'}>
              {s.value ?? s.label}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', gap: 3 },
  cell: {
    flex: 1,
    height: 22,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  done: { backgroundColor: theme.colors.accent },
  missed: { backgroundColor: theme.colors.danger },
  current: { borderWidth: 2, borderColor: theme.colors.accent },
  todo: {},
}));
