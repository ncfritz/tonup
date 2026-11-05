import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { LabGate, pct, useLab } from '@/features/capture-lab/LabBits';
import {
  activateModel,
  betterCandidate,
  fetchModels,
  MEASURES,
  verifyModels,
  type ModelScores,
  type Models,
} from '@/features/capture-lab/labData';
import { visionCapabilities } from '@/services/vision';
import { Button, Icon, Pressable, Screen, Text } from '@/ui';

const SHORT = {
  visitCorrect: 'lab.visit',
  dartCorrect: 'lab.segment',
  boardFound: 'lab.board',
} as const;

/** Lab's models on the phone: each one's numbers against the bars, set active, compare. */
export default function CaptureModels() {
  const { t } = useTranslation('capture');
  const { labUrl, reply, reload } = useLab(fetchModels);
  return (
    <Screen scroll>
      <View>
        <Text variant="heading" accessibilityRole="header">
          {t('models.title')}
        </Text>
        <Text tone="muted">{t('models.subtitle')}</Text>
      </View>
      <LabGate labUrl={labUrl} reply={reply} reload={reload}>
        {(d) => <ModelList d={d} labUrl={labUrl} reload={reload} />}
      </LabGate>
    </Screen>
  );
}

function ModelList({ d, labUrl, reload }: { d: Models; labUrl: string; reload: () => void }) {
  const { t } = useTranslation('capture');
  const { theme } = useUnistyles();
  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [onPhone, setOnPhone] = useState<string | null>(null);
  useEffect(() => {
    void visionCapabilities()
      .then((c) => setOnPhone(c.model ? (c.version ?? null) : null))
      .catch(() => setOnPhone(null));
  }, []);

  const active = d.models.find((m) => m.status === 'active') ?? null;
  const better = betterCandidate(d.models);
  const kept = new Map(d.prefill.map((p) => [p.model, p]));
  const picked = d.models.filter((m) => selected.includes(m.id));

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-4)));

  const activate = async (m: ModelScores) => {
    setBusy(true);
    const r = await activateModel(labUrl, m.id);
    setBusy(false);
    setNote(
      r.ok
        ? { ok: true, text: t('models.activated', { name: m.name }) }
        : { ok: false, text: r.error },
    );
    reload();
  };
  const verify = async (ids: number[]) => {
    setBusy(true);
    // Oldest first, so the deltas Lab shows are against the older model.
    const r = await verifyModels(
      labUrl,
      [...ids].sort((a, b) => a - b),
    );
    setBusy(false);
    setNote(r.ok ? { ok: true, text: t('models.queued') } : { ok: false, text: r.error });
    if (r.ok) setSelected([]);
  };

  if (!d.models.length) return <Text tone="muted">{t('models.none')}</Text>;

  return (
    <>
      {better && active ? (
        <View style={styles.better} testID="models-better">
          <Text variant="bodyStrong">
            {t('models.better', { name: better.name, active: active.name })}
          </Text>
          <Text variant="caption" tone="muted">
            {t('models.betterNote')}
          </Text>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button
                label={t('models.setActive', { name: better.name })}
                disabled={busy}
                onPress={() => void activate(better)}
                testID="models-activate-better"
              />
            </View>
            <View style={styles.flex}>
              <Button
                kind="secondary"
                label={t('models.verify')}
                disabled={busy || !d.testPhotos}
                onPress={() => void verify([active.id, better.id])}
              />
            </View>
          </View>
        </View>
      ) : null}

      {note ? (
        <Text tone={note.ok ? 'text' : 'danger'} testID="models-note">
          {note.text}
        </Text>
      ) : null}

      {d.models.map((m) => {
        const on = selected.includes(m.id);
        const k = kept.get(m.name);
        return (
          <View key={m.id} style={[styles.card, on && styles.cardOn]} testID={`model-${m.name}`}>
            <View style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={t('models.select', { name: m.name })}
                style={styles.check}
                onPress={() => toggle(m.id)}
                testID={`model-select-${m.name}`}
              >
                <View style={[styles.box, on && styles.boxOn]}>
                  {on ? (
                    <Icon name="check" color={theme.colors.onAccent} size={14} strokeWidth={3} />
                  ) : null}
                </View>
              </Pressable>
              <Text variant="title">{m.name}</Text>
              <View
                style={[
                  styles.tag,
                  m.status === 'active'
                    ? styles.tagActive
                    : m.status === 'candidate'
                      ? styles.tagCandidate
                      : null,
                ]}
              >
                <Text variant="tab" tone={m.status === 'retired' ? 'muted' : 'text'}>
                  {t(`models.status.${m.status}`)}
                </Text>
              </View>
              {onPhone && onPhone === m.name ? (
                <Text variant="caption" tone="muted">
                  {t('models.onPhone')}
                </Text>
              ) : null}
              <View style={styles.flex} />
              <Text variant="caption" tone="muted">
                {t('models.fromRun', { id: m.runId })}
              </Text>
            </View>
            <View style={styles.scores}>
              {MEASURES.map((x) => {
                const v = m[x.key];
                const ok = v != null && v >= x.bar;
                return (
                  <View key={x.key} style={styles.score}>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {`${t(SHORT[x.key])} · ${t('lab.bar', { bar: Math.round(x.bar * 100) })}`}
                    </Text>
                    <Text variant="value" tone={v == null || ok ? 'text' : 'pending'}>
                      {ok ? t('lab.passed', { value: pct(v) }) : pct(v)}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.row}>
              <Text variant="caption" tone="muted" style={styles.flex}>
                {m.evaluatedOn && m.samples != null
                  ? t('models.verifiedOn', { when: m.evaluatedOn, count: m.samples })
                  : t('models.notVerified')}
              </Text>
              {k?.visits ? (
                <Text variant="caption" tone="muted">
                  {t('models.kept', { pct: pct(k.accepted / k.visits, 0), count: k.visits })}
                </Text>
              ) : null}
            </View>
            {m.status === 'candidate' ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Button
                    kind="secondary"
                    label={t('models.verify')}
                    disabled={busy || !d.testPhotos}
                    onPress={() => void verify([m.id])}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    kind="secondary"
                    label={t('models.setActiveShort')}
                    disabled={busy}
                    onPress={() => void activate(m)}
                    testID={`model-activate-${m.name}`}
                  />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <Button
        label={
          picked.length === 2
            ? t('models.compareTwo', { a: picked[1]!.name, b: picked[0]!.name })
            : picked.length > 2
              ? t('models.compareMany', { count: picked.length })
              : t('models.pickTwo')
        }
        disabled={picked.length < 2 || busy || !d.testPhotos}
        onPress={() => void verify(picked.map((m) => m.id))}
        testID="models-compare"
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  better: {
    gap: theme.spacing.s,
    padding: theme.spacing.l,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.accentSoft,
  },
  card: {
    gap: theme.spacing.s,
    padding: theme.spacing.m,
    borderRadius: theme.radii.l,
    backgroundColor: theme.colors.surface,
  },
  // A model ticked to compare is filled, not outlined.
  cardOn: { backgroundColor: theme.colors.accentSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.s },
  flex: { flex: 1 },
  check: { width: 44, height: 44, marginLeft: -8, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  boxOn: { backgroundColor: theme.colors.accent },
  tag: {
    paddingHorizontal: theme.spacing.s,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.colors.surface2,
  },
  tagActive: { backgroundColor: theme.colors.accentSoft },
  tagCandidate: { backgroundColor: theme.colors.pendingSoft },
  scores: { flexDirection: 'row', gap: theme.spacing.xs },
  score: {
    flex: 1,
    gap: 2,
    padding: theme.spacing.s,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.bg,
  },
}));
