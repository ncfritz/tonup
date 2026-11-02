import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { TAB_BAR_SPACE } from './TabBar';

/**
 * Screen container: theme background, safe area and 16 pt side margins. Tab screens end their
 * content above the floating tab bar; full-screen pages (a game, a modal) pass
 * `edges={['top', 'bottom']}`.
 */
export function Screen({
  children,
  scroll = false,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}) {
  styles.useVariants({ tabBar: !edges.includes('bottom') });
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      ) : (
        <View style={styles.content}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create((theme) => ({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.l,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.s,
    gap: theme.spacing.m,
    variants: { tabBar: { true: { paddingBottom: TAB_BAR_SPACE } } },
  },
}));
