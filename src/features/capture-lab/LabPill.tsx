// Lab's state on every screen: a dot and a word (connected, can't reach, checking, not set).
// A tap checks again; Settings is where the address is.
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Pressable, Text } from '@/ui';

import { forgetLab, recheckLab, RECHECK_MS, useLabHealth } from './labHealth';
import { useCapture } from './store';

/** Keeps the shared check fresh: mounted once, in Capture's root layout. */
export function LabHealthWatch() {
  const labUrl = useCapture((s) => s.labUrl);
  useEffect(() => {
    if (!labUrl) {
      forgetLab();
      return;
    }
    void recheckLab(labUrl);
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void recheckLab(labUrl);
    }, RECHECK_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void recheckLab(labUrl);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [labUrl]);
  return null;
}

export type LabState = 'ok' | 'down' | 'checking' | 'unset';

export function useLabState(): LabState {
  const labUrl = useCapture((s) => s.labUrl);
  const health = useLabHealth((s) => (s.url === labUrl ? s.health : null));
  if (!labUrl) return 'unset';
  if (!health) return 'checking';
  return health.ok ? 'ok' : 'down';
}

export function LabPill() {
  const { t } = useTranslation('capture');
  const labUrl = useCapture((s) => s.labUrl);
  const state = useLabState();
  styles.useVariants({ state });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`lab.pill.${state}A11y`)}
      accessibilityHint={labUrl ? t('lab.pill.hint') : undefined}
      disabled={!labUrl}
      onPress={() => labUrl && void recheckLab(labUrl)}
      style={styles.pill}
      hitSlop={8}
      testID="lab-pill"
    >
      <View style={styles.dot} />
      <Text variant="caption" tone={state === 'down' ? 'danger' : 'muted'}>
        {t(`lab.pill.${state}`)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: theme.spacing.s,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    variants: {
      state: {
        ok: { backgroundColor: theme.colors.ok },
        down: { backgroundColor: theme.colors.danger },
        checking: { backgroundColor: theme.colors.muted },
        unset: { backgroundColor: theme.colors.muted },
      },
    },
  },
}));
