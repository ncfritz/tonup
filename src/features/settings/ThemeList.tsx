// The theme picker's rows, each drawn in its own theme's colours: Ton Up's Appearance screen
// and Capture's Settings both use it.
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { FONT_SETS } from '@/theme/fonts';
import palettes from '@/theme/palettes.json';
import { THEME_IDS, type Mode, type ThemeId } from '@/theme/themes';
import { Icon, Pressable, Text } from '@/ui';

export function ThemeList({
  value,
  mode,
  onPick,
  locked = () => false,
  onLocked,
}: {
  value: ThemeId;
  /** The mode the swatches are drawn in (the one showing now). */
  mode: Mode;
  onPick: (id: ThemeId) => void;
  /** Themes that need Ton Up Pro; pressing one calls `onLocked` instead. */
  locked?: (id: ThemeId) => boolean;
  onLocked?: () => void;
}) {
  const { t } = useTranslation('settings');
  const { theme } = useUnistyles();
  return (
    <>
      {THEME_IDS.map((id) => {
        const p = palettes[id][mode];
        const name = t(`appearance.themes.${id}.name`);
        const shut = locked(id);
        const selected = value === id;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={shut ? t('appearance.lockedA11y', { name }) : name}
            accessibilityHint={t(`appearance.themes.${id}.blurb`)}
            style={[styles.row, selected && styles.rowOn]}
            onPress={() => (shut ? onLocked?.() : onPick(id))}
            testID={`theme-${id}`}
          >
            {/* A swatch drawn in the theme's own colours (data, not this theme's tokens). */}
            <View style={[styles.swatch, { backgroundColor: p.bg }]}>
              <View style={[styles.swatchBar, { backgroundColor: p.surface }]}>
                <View style={[styles.swatchAccent, { backgroundColor: p.accent }]} />
                <Text
                  variant="bodyStrong"
                  style={{ color: p.text, fontFamily: FONT_SETS[id].displayBold }}
                >
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
            ) : shut ? (
              <View style={styles.lock}>
                <Icon name="lock" color={theme.colors.muted} size={16} />
                <Text variant="caption" tone="muted">
                  {t('appearance.locked')}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </>
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
