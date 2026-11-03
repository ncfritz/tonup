import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { DevMenu } from '@/dev/DevMenu';
import { exportBackup, exportCsv, importBackup } from '@/features/backup/backup';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { ListRow, Pressable, Screen, Section, SegmentedControl, Text, ToggleRow } from '@/ui';

const DOUBLES = [20, 16, 18, 12, 10, 8, 25] as const;

/** Settings (docs/design/screens.md → Settings). */
export default function Settings() {
  const { t } = useTranslation('settings');
  const { t: tp } = useTranslation('pro');
  const s = useSettings();
  const proOwned = useProOwned();
  const [message, setMessage] = useState<string | null>(null);

  const doImport = async () => {
    setMessage(null);
    const r = await importBackup();
    if (r.kind === 'done')
      setMessage(t('data.imported', { sessions: r.sessions, skipped: r.skipped }));
    else if (r.kind === 'error') setMessage(t(`data.errors.${r.error}`));
  };
  const doCsv = async () => {
    setMessage(null);
    if (!(await exportCsv())) setMessage(t('data.csvEmpty'));
  };
  const mode = t(`appearance.${s.appearance}`);
  const version = Constants.expoConfig?.version ?? '';
  const build = Constants.expoConfig?.ios?.buildNumber ?? '';

  return (
    <Screen scroll>
      <Text variant="heading" accessibilityRole="header">
        {t('title')}
      </Text>
      <Section label={tp('title')}>
        <ListRow
          label={tp('settingsRow')}
          value={proOwned ? tp('settingsOwned') : undefined}
          note={proOwned ? undefined : tp('settingsGet')}
          onPress={() => router.push('/pro')}
          testID="settings-pro"
        />
      </Section>
      <Section label={t('sections.appearance')}>
        <ListRow
          label={t('appearance.row')}
          value={t('appearance.value', { theme: t(`appearance.themes.${s.theme}.name`), mode })}
          onPress={() => router.push('/settings/appearance')}
          testID="settings-appearance"
        />
      </Section>
      <Section label={t('sections.playing')}>
        <ToggleRow
          label={t('playing.caller')}
          note={t('playing.callerNote')}
          value={s.caller}
          onChange={(v) => s.set('caller', v)}
          testID="settings-caller"
        />
        <ToggleRow
          label={t('playing.haptics')}
          value={s.haptics}
          onChange={(v) => s.set('haptics', v)}
        />
        <Text variant="bodyStrong">{t('playing.input')}</Text>
        <SegmentedControl<'board' | 'keypad'>
          accessibilityLabel={t('playing.input')}
          value={s.defaultInput}
          onChange={(v) => s.set('defaultInput', v)}
          segments={[
            { value: 'board', label: t('playing.board') },
            { value: 'keypad', label: t('playing.keypad') },
          ]}
        />
        <Text variant="bodyStrong">{t('playing.double')}</Text>
        <Text variant="caption" tone="muted">
          {t('playing.doubleNote')}
        </Text>
        <View
          style={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('playing.double')}
        >
          {[null, ...DOUBLES].map((d) => {
            const on = s.preferredDouble === d;
            const label =
              d === null ? t('playing.doubleNone') : d === 25 ? t('playing.doubleBull') : `D${d}`;
            return (
              <Pressable
                key={String(d)}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => s.set('preferredDouble', d)}
                testID={`double-${d ?? 'none'}`}
              >
                <Text variant="bodyStrong" tone={on ? 'onAccent' : 'text'}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
      <Section label={t('sections.data')}>
        <ListRow
          label={t('data.export')}
          note={t('data.exportNote')}
          onPress={() => void exportBackup()}
        />
        <ListRow label={t('data.csv')} note={t('data.csvNote')} onPress={() => void doCsv()} />
        <ListRow
          label={t('data.import')}
          note={t('data.importNote')}
          onPress={() => void doImport()}
        />
        {message ? (
          <Text tone="accent" accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        <Text variant="caption" tone="muted">
          {t('data.privacy')}
        </Text>
      </Section>
      <Section label={t('sections.about')}>
        <ListRow label={t('about.version')} value={t('about.versionValue', { version, build })} />
      </Section>
      {__DEV__ ? <DevMenu /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
  chip: {
    minWidth: 52,
    height: 40,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: theme.colors.accent },
}));
