import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { haptics } from '@/services/haptics';

import { Icon, type IconName } from './icons';
import { PLAY_RISE, PLAY_SIZE, PlayButton } from './PlayButton';
import { Pressable } from './Pressable';
import { Text } from './Text';

const ICONS: Record<string, IconName> = {
  practice: 'practice',
  history: 'history',
  rules: 'rules',
  settings: 'settings',
};

/** The pill's height and its gap from the bottom of the screen. */
export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_BOTTOM = 22;
/** Room tab screens leave at the end of their content so nothing hides behind the bar. */
export const TAB_BAR_SPACE = TAB_BAR_HEIGHT + TAB_BAR_BOTTOM + 16;

const PLAY_COLUMN = 96;

/**
 * Our own tab bar (docs/design/screens.md → Tab bar): a pill floating above the bottom edge,
 * Practice and History on the left, Rules and Settings on the right, and the dartboard Play
 * button rising out of the middle. Play is the home screen (the `index` route).
 */
export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { theme } = useUnistyles();

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = typeof options?.title === 'string' ? options.title : route.name;
          const play = route.name === 'index';
          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
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
  // The Play column reaches up so the whole raised button is tappable.
  playColumn: {
    width: PLAY_COLUMN,
    height: TAB_BAR_HEIGHT + PLAY_RISE,
    marginTop: -PLAY_RISE,
    alignItems: 'center',
  },
  playButton: { marginTop: -2, width: PLAY_SIZE + 4, height: PLAY_SIZE + 4 },
}));
