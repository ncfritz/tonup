import { router } from 'expo-router';

import { useRulesT } from '@/content/rules';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Header, Screen, Text } from '@/ui';

type Term = { term: string; def: string };

export default function Glossary() {
  const { t, list } = useRulesT();
  const terms = list<Term>('glossary.terms');
  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header title={t('glossary.title')} backLabel={t('page.back')} onBack={() => router.back()} />
      {terms.map((g) => (
        <View key={g.term} style={styles.row}>
          <Text variant="bodyStrong">{g.term}</Text>
          <Text tone="muted">{g.def}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    gap: 2,
  },
}));
