import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { canUseTheme } from '@/domain/pro';
import { useProOwned } from '@/features/pro/pro';
import { useSettings, type AppearanceSetting } from '@/features/settings/store';
import previews from '@/theme/previews.json';
import { Header, Icon, Pressable, Screen, Section, SegmentedControl, Text } from '@/ui';

type PreviewId = keyof typeof previews;
const ORDER: PreviewId[] = ['pro', 'chalkboard', 'arcade', 'heritage', 'training'];
/** Themes with palettes so far; the other four are Pro and arrive in M14. */
const BUILT = new Set<PreviewId>(['pro']);

/** Settings › Appearance (docs/design/screens.md; the canvas's theme picker). */
export default function Appearance() {
  const { t } = useTranslation('settings');
  const { theme } = useUnistyles();
  const appearance = useSettings((s) => s.appearance);
  const current = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const proOwned = useProOwned();
  const system = useColorScheme();
  const mode = appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : appearance;

  return (
    <Screen scroll>
      <Header title={t('appearance.title')} backLabel={t('title')} onBack={() => router.back()} />
      <Section label={t('appearance.mode')}>
        <SegmentedControl<AppearanceSetting>
          accessibilityLabel={t('appearance.mode')}
          value={appearance}
          onChange={(v) => set('appearance', v)}
          segments={[
            { value: 'system', label: t('appearance.system') },
            { value: 'light', label: t('appearance.light') },
            { value: 'dark', label: t('appearance.dark') },
          ]}
        />
        <Text variant="caption" tone="muted">
          {t('appearance.modeNote')}
        </Text>
      </Section>
      <Section label={t('appearance.theme')}>
        {ORDER.map((id) => {
          const p = previews[id][mode];
          const name = t(`appearance.themes.${id}.name`);
          const unlocked = canUseTheme(id, proOwned);
          const open = unlocked && BUILT.has(id);
          const selected = current === id;
          return (
            <Pressable
              key={id}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: unlocked && !open }}
              accessibilityLabel={unlocked ? name : t('appearance.lockedA11y', { name })}
              accessibilityHint={t(`appearance.themes.${id}.blurb`)}
              disabled={unlocked && !open}
              style={[styles.row, selected && styles.rowOn]}
              onPress={() => (open ? set('theme', id as 'pro') : router.push('/pro'))}
              testID={`theme-${id}`}
            >
              {/* A swatch drawn in the theme's own colours (data, not this theme's tokens). */}
              <View style={[styles.swatch, { backgroundColor: p.bg }]}>
                <View style={[styles.swatchBar, { backgroundColor: p.surface }]}>
                  <View style={[styles.swatchAccent, { backgroundColor: p.accent }]} />
                  <Text variant="bodyStrong" style={{ color: p.text }}>
                    140
                  </Text>
                </View>
              </View>
              <View style={styles.flex}>
                <Text variant="title">{name}</Text>
                <Text variant="caption" tone="muted">
                  {t(`appearance.themes.${id}.blurb`)}
                </Text>
              </View>
              {selected ? (
                <Icon name="check" color={theme.colors.accent} />
              ) : open ? null : unlocked ? (
                <Text variant="caption" tone="muted">
                  {t('appearance.soon')}
                </Text>
              ) : (
                <View style={styles.lock}>
                  <Icon name="lock" color={theme.colors.muted} size={16} />
                  <Text variant="caption" tone="muted">
                    {t('appearance.locked')}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1, gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.m,
    padding: theme.spacing.m,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowOn: { borderColor: theme.colors.accent },
  swatch: {
    width: 72,
    height: 52,
    borderRadius: theme.radii.s,
    padding: 6,
    justifyContent: 'center',
  },
  swatchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 4,
    paddingRight: 6,
    overflow: 'hidden',
  },
  swatchAccent: { width: 6, alignSelf: 'stretch' },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 4 },
}));
