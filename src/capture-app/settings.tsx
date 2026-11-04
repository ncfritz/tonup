import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { checkLab, type LabHealth } from '@/features/capture-lab/lab';
import { fileOutbox } from '@/features/capture-lab/outboxFiles';
import { useCapture } from '@/features/capture-lab/store';
import { visionCapabilities } from '@/services/vision';
import { Button, Header, ListRow, Screen, Section, Text, ToggleRow } from '@/ui';

/** Lab's address, the model and pre-filling, and the sent photos kept on the phone. */
export default function CaptureSettings() {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const labUrl = useCapture((s) => s.labUrl);
  const prefill = useCapture((s) => s.prefill);
  const [address, setAddress] = useState(labUrl);
  const [test, setTest] = useState<LabHealth | null>(null);
  const [testing, setTesting] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [sent, setSent] = useState(() => {
    try {
      return fileOutbox.sentPhotoCount();
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    void visionCapabilities().then((c) => setModel(c.model ? (c.version ?? '?') : null));
  }, []);

  const saveAddress = () => useCapture.getState().set({ labUrl: address.trim() });
  const runTest = async () => {
    saveAddress();
    setTesting(true);
    setTest(await checkLab(address));
    setTesting(false);
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('settings.title')}
        backLabel={t('settings.back')}
        onBack={() => router.back()}
      />
      <Section label={t('settings.lab')}>
        <View style={styles.block}>
          <Text variant="caption" tone="muted">
            {t('settings.labAddress')}
          </Text>
          <TextInput
            value={address}
            onChangeText={setAddress}
            onEndEditing={saveAddress}
            placeholder={t('settings.labPlaceholder')}
            placeholderTextColor={theme.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel={t('settings.labAddress')}
            style={styles.input}
            testID="settings-lab-url"
          />
          <Button
            kind="secondary"
            label={t('settings.test')}
            onPress={() => void runTest()}
            disabled={!address.trim() || testing}
            testID="settings-test"
          />
          {test ? (
            <Text tone={test.ok ? 'text' : 'danger'} testID="settings-test-result">
              {test.ok
                ? t('settings.testOk', { version: test.version })
                : t('settings.testFail', { error: test.error })}
            </Text>
          ) : null}
          <Text variant="caption" tone="muted">
            {t('settings.labNote')}
          </Text>
        </View>
      </Section>
      <Section label={t('settings.model')}>
        <ListRow
          label={model ? t('settings.modelInstalled', { version: model }) : t('settings.modelNone')}
        />
        <ToggleRow
          label={t('settings.prefill')}
          note={t('settings.prefillNote')}
          value={prefill}
          onChange={(v) => useCapture.getState().set({ prefill: v })}
        />
      </Section>
      <Section label={t('settings.storage')}>
        <ListRow label={t('settings.sent')} note={t('settings.sentNote', { count: sent })} />
        <Button
          kind="secondary"
          label={t('settings.clear')}
          disabled={sent === 0}
          onPress={() => {
            fileOutbox.clearSent();
            setSent(0);
          }}
        />
      </Section>
      <Text variant="caption" tone="muted">
        {t('settings.about')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  block: { gap: theme.spacing.s },
  input: {
    minHeight: 44,
    borderRadius: theme.radii.s,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.bg,
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.m,
    fontSize: 16,
  },
}));
