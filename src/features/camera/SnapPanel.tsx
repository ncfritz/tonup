import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Button, Icon, Text } from '@/ui';

/** Camera input on the scoring screen: throw, then snap the board before you pull. */
export function SnapPanel({
  disabled,
  left,
  onSnap,
}: {
  disabled: boolean;
  /** Darts still to come in this visit. */
  left: number;
  onSnap: () => void;
}) {
  const { t } = useTranslation('game');
  const { theme } = useUnistyles();
  return (
    <View style={styles.wrap}>
      <Icon name="camera" color={theme.colors.accent} size={48} />
      <Text variant="title" style={styles.center}>
        {t('snap.panelTitle', { count: left })}
      </Text>
      <Text tone="muted" style={styles.center}>
        {t('snap.panelBody')}
      </Text>
      <View style={styles.button}>
        <Button label={t('snap.open')} onPress={onSnap} disabled={disabled} testID="open-snap" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.m,
  },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
}));
