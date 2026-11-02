import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { drawPoint } from '@/domain/board';
import type { PlayerRef } from '@/domain/darts';
import { X01_DEFAULTS, type X01Settings } from '@/domain/games/x01';
import { bestOf, botId, YOU_ID } from '@/features/game/lineup';
import { lastMatch, resumable, type MatchCard, type ResumeCard } from '@/features/game/recent';
import { startX01 } from '@/features/game/session';
import { dayLabel } from '@/features/game/when';
import { useSettings } from '@/features/settings/store';
import { Board, Button, Pressable, Screen, Text } from '@/ui';

/** Play, the home tab (docs/design/screens.md → Play; navigation option E). */
export default function Play() {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game');
  const [resume, setResume] = useState<ResumeCard | null>(null);
  const [match, setMatch] = useState<MatchCard | null>(null);
  const [now, setNow] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setResume(resumable());
      setMatch(lastMatch());
      setNow(Date.now());
    }, []),
  );

  return (
    <Screen scroll>
      <View>
        <Text variant="overline" tone="accent">
          {t('wordmark')}
        </Text>
        <Text variant="heading" accessibilityRole="header">
          {t('screens.play')}
        </Text>
      </View>
      {resume ? <ResumeCardView card={resume} /> : null}
      <QuickStart />
      <View style={styles.shortcuts}>
        <Shortcut label={tg('home.x01')} onPress={() => router.push('/new-game')} />
        <Shortcut label={tg('home.allGames')} onPress={() => router.push('/new-game')} />
      </View>
      <Text variant="overline" tone="muted">
        {tg('home.pickUp')}
      </Text>
      <LastMatchView card={match} now={now} />
      <LastPractice />
    </Screen>
  );
}

const go = (sessionId: string) =>
  router.push({ pathname: '/game/[sessionId]', params: { sessionId } });

function ResumeCardView({ card }: { card: ResumeCard }) {
  const { t } = useTranslation('game');
  return (
    <View style={styles.card}>
      <Text variant="overline" tone="accent">
        {t('home.resumeTitle')}
      </Text>
      <Text variant="bodyStrong">
        {t('home.resumeBody', {
          game: card.startScore,
          players: card.players.map((p, i) => `${p.name} ${card.remaining[i]}`).join(' · '),
        })}
      </Text>
      <Button label={t('home.resume')} onPress={() => go(card.sessionId)} testID="resume-game" />
    </View>
  );
}

function QuickStart() {
  const { t } = useTranslation('game');
  const last = useSettings((s) => s.lastX01);
  const lineup = useSettings((s) => s.lastLineup);
  const settings: X01Settings = last ?? X01_DEFAULTS;
  const players: PlayerRef[] = lineup ?? [
    { id: YOU_ID, name: t('players.you') },
    { id: botId(3), name: t('players.bot', { level: 3 }), botLevel: 3 },
  ];
  const opponents = players
    .slice(1)
    .map((p) => p.name)
    .join(', ');
  const out =
    settings.out === 'double'
      ? t('newGame.doubleOut')
      : settings.out === 'master'
        ? t('newGame.masterOut')
        : t('newGame.straightOut');
  return (
    <View style={styles.card}>
      <Text variant="overline" tone="muted">
        {t('home.quickStart')}
      </Text>
      <View style={styles.quickRow}>
        <View style={styles.flex}>
          <Text variant="title" style={styles.quickTitle}>
            {opponents
              ? t('home.quickTitle', { start: settings.startScore, opponents })
              : t('home.quickSolo', { start: settings.startScore })}
          </Text>
          <Text variant="caption" tone="muted">
            {t('home.quickBody', {
              format: t('newGame.legs', { count: bestOf(settings.legs) }),
              out,
            })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.start, pressed && styles.pressed]}
          onPress={() => go(startX01(settings, players))}
          testID="quick-start"
        >
          <Text variant="title" tone="onAccent">
            {t('home.start')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text variant="value">{label}</Text>
    </Pressable>
  );
}

function LastMatchView({ card, now }: { card: MatchCard | null; now: number }) {
  const { t } = useTranslation('game');
  if (!card) {
    return (
      <View style={styles.card}>
        <Text variant="overline" tone="muted">
          {t('home.lastMatchEmpty')}
        </Text>
        <Text tone="muted">{t('home.noMatch')}</Text>
      </View>
    );
  }
  const markers = card.game.darts
    .filter((d) => d.playerId === card.me.id)
    .flatMap((d) => {
      const p = drawPoint(d);
      return p ? [{ point: p, text: '' }] : [];
    });
  const when = dayLabel(card.endedAt, now, {
    today: t('home.today'),
    yesterday: t('home.yesterday'),
  });
  const names = card.opponents.map((p) => p.name).join(', ');
  const s = card.stats;
  return (
    <View style={[styles.card, styles.row]}>
      <Board
        size={84}
        muted
        markers={markers}
        markerRadius={2.5}
        accessibilityLabel={t('home.heatmapA11y')}
      />
      <View style={styles.flex}>
        <Text variant="overline" tone="muted">
          {t('home.lastMatch', { when })}
        </Text>
        <Text variant="title">
          {card.opponents.length
            ? t(card.won ? 'home.won' : 'home.lost', { score: card.score, opponents: names })
            : t('home.soloResult', { start: card.startScore, darts: s.darts })}
        </Text>
        <Text variant="caption" tone="muted">
          {t('home.matchLine', {
            start: card.startScore,
            average: s.average.toFixed(1),
            hits: s.checkouts,
            attempts: s.checkoutAttempts,
          })}
        </Text>
        <View style={styles.actions}>
          <SmallLink
            label={t('home.replay')}
            onPress={() =>
              router.push({
                pathname: '/replay/[sessionId]',
                params: { sessionId: card.sessionId },
              })
            }
          />
          <SmallLink
            label={t('home.rematch')}
            onPress={() =>
              go(startX01(card.game.session.settings as X01Settings, card.game.session.players))
            }
          />
        </View>
      </View>
    </View>
  );
}

function LastPractice() {
  const { t } = useTranslation('game');
  // Drills arrive in M6; until then the card explains what it will show.
  return (
    <View style={styles.card}>
      <Text variant="overline" tone="muted">
        {t('home.lastPractice')}
      </Text>
      <Text tone="muted">{t('home.noPractice')}</Text>
      <View style={styles.actions}>
        <SmallLink label={t('home.allDrills')} onPress={() => router.navigate('/practice')} />
      </View>
    </View>
  );
}

function SmallLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      onPress={onPress}
    >
      <Text variant="bodyStrong" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1, gap: theme.spacing.xxs },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.l,
    padding: theme.spacing.l,
    gap: theme.spacing.s,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.m },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.m },
  quickTitle: { fontSize: 28, lineHeight: 30 },
  start: {
    height: 52,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcuts: { flexDirection: 'row', gap: theme.spacing.s },
  shortcut: {
    flex: 1,
    height: 52,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: theme.spacing.s, marginTop: theme.spacing.xs },
  link: {
    height: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface2,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
}));
