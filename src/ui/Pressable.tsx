import type { ComponentProps } from 'react';
import { Pressable as RNPressable } from 'react-native';

/**
 * React Native's Pressable. Use this one in the app (ESLint enforces it) so press behaviour
 * can change in one place, as in Tippytoe.
 */
export function Pressable(props: ComponentProps<typeof RNPressable>) {
  return <RNPressable {...props} />;
}
