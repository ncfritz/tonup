import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { LabHealth } from '@/features/capture-lab/lab';
import { ScreenTitle } from '@/features/capture-lab/LabBits';
import { recheckLab } from '@/features/capture-lab/labHealth';
import { modelFiles } from '@/features/capture-lab/modelFiles';
import { checkForModel, pullModel, type PullStatus } from '@/features/capture-lab/modelPull';
import { fileOutbox } from '@/features/capture-lab/outboxFiles';
import { useCapture } from '@/features/capture-lab/store';
import { ThemeList } from '@/features/settings/ThemeList';
import { reloadModel, visionCapabilities } from '@/services/vision';
import { useMode } from '@/theme/ThemeSync';
import { Button, ListRow, Screen, Section, SegmentedControl, Text, ToggleRow } from '@/ui';

/** Lab's address, the model and pre-filling, and the sent photos kept on the phone. */
export default function CaptureSettings() {
  const { t } = useTranslation('capture');
  const { t: ts } = useTranslation('settings');
  const { theme } = useUnistyles();
  const labUrl = useCapture((s) => s.labUrl);
  const prefill = useCapture((s) => s.prefill);
  const appearance = useCapture((s) => s.appearance);
  const current = useCapture((s) => s.theme);
  const mode = useMode(appearance);
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

  const [labModel, setLabModel] = useState<PullStatus | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pullNote, setPullNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void visionCapabilities().then((c) => setModel(c.model ? (c.version ?? '?') : null));
  }, []);

  const checkModel = async (url: string) => {
    if (!url.trim()) return;
    setLabModel(null);
    setLabModel(await checkForModel(url, modelFiles));
  };
  useEffect(() => {
    let live = true;
    if (labUrl) void checkForModel(labUrl, modelFiles).then((s) => live && setLabModel(s));
    return () => {
      live = false;
    };
    // Once on opening; a test or a pull checks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAddress = () => useCapture.getState().set({ labUrl: address.trim() });
  const runTest = async () => {
    saveAddress();
    setTesting(true);
    const h = await recheckLab(address.trim());
    setTest(h);
    setTesting(false);
    if (h.ok) void checkModel(address);
  };

  const getModel = async () => {
    if (labModel?.kind !== 'available') return;
    const m = labModel.model;
    setPullNote(null);
    setProgress(0);
    const r = await pullModel(labUrl, m, modelFiles, reloadModel, (done, total) =>
      setProgress(total ? Math.round((done / total) * 100) : 0),
    );
    setProgress(null);
    setPullNote(
      r.ok
        ? { ok: true, text: t('settings.modelInstalledNow', { name: r.name }) }
        : { ok: false, text: t('settings.modelFailed', { error: r.error }) },
    );
    const caps = await visionCapabilities();
    setModel(caps.model ? (caps.version ?? '?') : null);
    await checkModel(labUrl);
  };

  const labLine = (s: PullStatus) => {
    switch (s.kind) {
      case 'unreachable':
        return t('settings.modelUnreachable', { error: s.error });
      case 'none':
        return t('settings.modelLabNone');
      case 'no-package':
        return t('settings.modelNoPackage', { name: s.name });
      case 'current':
        return t('settings.modelCurrent', { name: s.name });
      case 'available':
        return t('settings.modelAvailable', {
          name: s.model.name,
          visit:
            s.model.visitCorrect == null ? 'none' : `${Math.round(s.model.visitCorrect * 100)}%`,
        });
    }
  };

  return (
    <Screen scroll>
      <ScreenTitle title={t('settings.title')} />
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
        {labUrl ? (
          <View style={styles.block}>
            <Text variant="caption" tone="muted" testID="settings-lab-model">
              {labModel ? labLine(labModel) : t('settings.modelChecking')}
            </Text>
            {labModel?.kind === 'available' ? (
              <Button
                kind="secondary"
                label={
                  progress !== null
                    ? t('settings.modelDownloading', { percent: progress })
                    : t('settings.modelGet', { name: labModel.model.name })
                }
                disabled={progress !== null}
                onPress={() => void getModel()}
                testID="settings-get-model"
              />
            ) : null}
            {pullNote ? (
              <Text tone={pullNote.ok ? 'text' : 'danger'} testID="settings-pull-note">
                {pullNote.text}
              </Text>
            ) : null}
          </View>
        ) : null}
        <ToggleRow
          label={t('settings.prefill')}
          note={t('settings.prefillNote')}
          value={prefill}
          onChange={(v) => useCapture.getState().set({ prefill: v })}
        />
      </Section>
      <Section label={t('settings.appearance')}>
        <SegmentedControl<typeof appearance>
          accessibilityLabel={ts('appearance.mode')}
          value={appearance}
          onChange={(v) => useCapture.getState().set({ appearance: v })}
          segments={[
            { value: 'system', label: ts('appearance.system') },
            { value: 'light', label: ts('appearance.light') },
            { value: 'dark', label: ts('appearance.dark') },
          ]}
        />
        <ThemeList
          value={current}
          mode={mode}
          onPick={(id) => useCapture.getState().set({ theme: id })}
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
