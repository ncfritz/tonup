import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { buildReport, shareReport, SUPPORT_EMAIL } from '@/features/diagnostics/report';
import { recentLog } from '@/services/diagnostics';
import { Button, Header, Screen, Section, Text } from '@/ui';

/** Settings › Report a problem (docs/design/screens.md → Settings). */
export default function Report() {
  const { t } = useTranslation('settings');
  const { theme } = useUnistyles();
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState(false);
  const entries = useMemo(() => recentLog().length, []);
  const text = preview ? buildReport({ note }) : '';

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('report.title')}
        backLabel={t('report.close')}
        onBack={() => router.back()}
      />
      <Text tone="muted">{t('report.intro', { email: SUPPORT_EMAIL })}</Text>
      <Section label={t('report.noteLabel')}>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          accessibilityLabel={t('report.noteLabel')}
          placeholder={t('report.notePlaceholder')}
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, theme.type.body, { color: theme.colors.text }]}
          testID="report-note"
        />
      </Section>
      <Section label={t('report.includes')}>
        {[
          t('report.include1'),
          t('report.include2'),
          t('report.include3'),
          t('report.include4', { n: entries }),
        ].map((line) => (
          <Text key={line} tone="muted">
            {`• ${line}`}
          </Text>
        ))}
        <Button
          kind="secondary"
          label={preview ? t('report.hide') : t('report.preview')}
          onPress={() => setPreview((p) => !p)}
          testID="report-preview"
        />
        {preview ? (
          <View style={styles.preview}>
            <Text variant="caption" selectable testID="report-text">
              {text}
            </Text>
          </View>
        ) : null}
      </Section>
      <Button
        label={t('report.send')}
        accessibilityLabel={t('report.sendA11y')}
        onPress={() => void shareReport(note)}
        testID="report-send"
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  input: {
    minHeight: 120,
    textAlignVertical: 'top',
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
  preview: {
    borderRadius: theme.radii.m,
    padding: theme.spacing.m,
    backgroundColor: theme.colors.surface,
  },
}));
