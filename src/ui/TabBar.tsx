import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { haptics } from '@/services/haptics';

import { Icon, type IconName } from './icons';
import { PLAY_SIZE, PlayButton } from './PlayButton';
import { Pressable } from './Pressable';
import { Text } from './Text';

const ICONS: Record<string, IconName> = {
  practice: 'practice',
  history: 'history',
  rules: 'rules',
  settings: 'settings',
  // Ton Up Capture's tabs (src/capture-app/(tabs)); its centre button is Sessions.
  overview: 'overview',
  models: 'models',
  runs: 'runs',
};

/** The pill's height and its gap from the bottom of the screen. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_BOTTOM = 22;
/** Room tab screens leave at the end of their content so nothing hides behind the bar. */
export const TAB_BAR_SPACE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 16;

const PLAY_COLUMN = 96;
/** How far the Play button reaches past the bar's top and bottom edges. */
const OVERHANG = Math.max(0, (PLAY_SIZE + 4 - TAB_BAR_HEIGHT) / 2);

/**
 * Our own tab bar (docs/design/screens.md → Tab bar): a pill floating above the bottom edge,
 * Practice and History on the left, Rules and Settings on the right, and the dartboard Play
 * button centred in the middle, a little larger than the bar. Play is the home screen (the `index` route).
 * Ton Up Capture uses the same bar: Overview and Models, Sessions in the middle, Runs and Settings.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { theme } = useUnistyles();
  // Tabs are the routes with an icon, and home; anything else is a screen under a tab.
  const visible = state.routes.filter((r) => r.name === 'index' || r.name in ICONS);
  const current = state.routes[state.index];
  const highlighted = visible.some((r) => r.key === current?.key)
    ? current?.key
    : visible.find((r) => r.name === 'index')?.key;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.pill}>
        {visible.map((route) => {
          // A screen that isn't a tab (Capture's session photos) shows its home tab as current.
          const focused = route.key === highlighted;
          const options = descriptors[route.key]?.options;
          const label = typeof options?.title === 'string' ? options.title : route.name;
          const play = route.name === 'index';
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (route.key !== current?.key && !event.defaultPrevented) {
              haptics.selection();
              navigateToTab(route.key);
            }
          };
          const color = focused ? theme.colors.accent : theme.colors.muted;
          if (play) {
            return (
              <Pressable
                key={route.key}
                testID="tab-play"
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                style={styles.playColumn}
                // The button overhangs the bar a little; all of it is tappable.
                hitSlop={{ top: OVERHANG, bottom: OVERHANG }}
                onPress={onPress}
              >
                <View style={styles.playButton}>
                  <PlayButton focused={focused} label={options?.tabBarLabel as string} />
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={route.key}
              testID={`tab-${route.name}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={styles.tab}
              onPress={onPress}
            >
              <Icon name={ICONS[route.name] ?? 'practice'} color={color} />
              <Text variant="tab" style={{ color }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // Floats over the screen; box-none so the space around the pill passes touches through.
  wrap: {
    position: 'absolute',
    left: theme.spacing.l,
    right: theme.spacing.l,
    bottom: TAB_BAR_BOTTOM,
  },
  pill: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
    minHeight: TAB_BAR_HEIGHT,
  },
  // Centred on the bar: the button's middle is the bar's middle.
  playColumn: {
    width: PLAY_COLUMN,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: { width: PLAY_SIZE + 4, height: PLAY_SIZE + 4 },
}));
