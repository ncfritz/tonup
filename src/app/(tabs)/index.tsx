import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { drawPoint } from '@/domain/board';
import type { PlayerRef } from '@/domain/darts';
import type { GameId } from '@/domain/games';
import type { X01Settings } from '@/domain/games/x01';
import { formatStat, gameName, rowFormat } from '@/features/game/format';
import { bestOf, botId, YOU_ID } from '@/features/game/lineup';
import { deal, isPresetId, PRESETS, presetOf, settingsFor } from '@/features/game/presets';
import { lastMatch, resumable, type MatchCard, type ResumeCard } from '@/features/game/recent';
import { startGame } from '@/features/game/session';
import { GamePicker } from '@/features/newgame/GamePicker';
import { dayLabel } from '@/features/game/when';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { canPlayRules } from '@/domain/pro';
import { Board, Button, Pressable, Screen, Text } from '@/ui';

/** Play, the home tab (docs/design/screens.md → Play; navigation option E). */
export default function Play() {
  const { t } = useTranslation();
  const { t: tg } = useTranslation('game');
  const [resume, setResume] = useState<ResumeCard | null>(null);
  const [match, setMatch] = useState<MatchCard | null>(null);
  const [now, setNow] = useState(0);
  const proOwned = useProOwned();
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
      <LastMatchView card={match} now={now} />
      <Text variant="overline" tone="muted">
        {tg('home.allGames')}
      </Text>
      {/* Every game; a tap opens New game set up for it (docs/design/screens.md → Play). */}
      <GamePicker
        proOwned={proOwned}
        recent={[]}
        search={false}
        describe={() => ''}
        onPick={(game) => router.push({ pathname: '/new-game', params: { game } })}
        onAgain={() => {}}
        onLocked={() => router.push('/pro')}
      />
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
          game: gameName(t, card.typeId, card.settings),
          players: card.rows
            .map((r) => `${r.name} ${rowFormat(t, card.typeId)?.(r).big ?? r.score}`)
            .join(' · '),
        })}
      </Text>
      <Button label={t('home.resume')} onPress={() => go(card.sessionId)} testID="resume-game" />
    </View>
  );
}

function QuickStart() {
  const { t } = useTranslation('game');
  const last = useSettings((s) => s.lastGameId);
  const saved = useSettings((s) => s.gameSettings);
  const lineup = useSettings((s) => s.lastLineup);
  const proOwned = useProOwned();
  // The last game, unless it's Pro and Pro isn't owned (a refund): then X01.
  const presetId = isPresetId(last) && canPlayRules(last, proOwned) ? last : 'x01';
  const preset = PRESETS[presetId];
  const gameId: GameId = preset.game;
  const settings = settingsFor(presetId, saved[gameId]);
  const players: PlayerRef[] = lineup ?? [
    { id: YOU_ID, name: t('players.you') },
    { id: botId(3), name: t('players.bot', { level: 3 }), botLevel: 3 },
  ];
  const opponents = players
    .slice(1)
    .map((p) => p.name)
    .join(', ');
  const name = gameName(t, gameId, settings);
  let body = '';
  if (gameId === 'x01') {
    const x = settings as unknown as X01Settings;
    const out =
      x.out === 'double'
        ? t('newGame.doubleOut')
        : x.out === 'master'
          ? t('newGame.masterOut')
          : t('newGame.straightOut');
    body = t('home.quickBody', { format: t('newGame.legs', { count: bestOf(x.legs) }), out });
  }
  // Killer numbers and Random Cricket's six are drawn fresh for each game.
  const start = () => go(startGame(gameId, deal(gameId, settings, players), players));
  const blocked = players.length < preset.players.min || players.length > preset.players.max;
  return (
    <View style={styles.card}>
      <Text variant="overline" tone="muted">
        {t('home.quickStart')}
      </Text>
      <View style={styles.quickRow}>
        <View style={styles.flex}>
          <Text variant="title" style={styles.quickTitle}>
            {opponents
              ? t('home.quickTitle', { start: name, opponents })
              : t('home.quickSolo', { start: name })}
          </Text>
          {body ? (
            <Text variant="caption" tone="muted">
              {body}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={blocked}
          style={({ pressed }) => [styles.start, pressed && styles.pressed]}
          onPress={start}
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
  const name = gameName(t, card.typeId, card.settings);
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
          {card.opponents.length === 0
            ? s
              ? t('home.soloResult', { start: name, darts: s.darts })
              : name
            : card.draw
              ? t('home.drew', { game: name, opponents: names })
              : card.score
                ? t(card.won ? 'home.won' : 'home.lost', { score: card.score, opponents: names })
                : t(card.won ? 'home.wonGame' : 'home.lostGame', { game: name, opponents: names })}
        </Text>
        <Text variant="caption" tone="muted">
          {s
            ? t('home.matchLine', {
                start: name,
                average: s.average.toFixed(1),
                hits: s.checkouts,
                attempts: s.checkoutAttempts,
              })
            : card.line
              ? t('home.otherLine', {
                  game: name,
                  stat: `${t(`stats.${card.line.key}` as 'stats.mpr')} ${formatStat(card.line)}`,
                })
              : name}
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
          <SmallLink label={t('home.rematch')} onPress={() => go(rematch(card))} />
        </View>
      </View>
    </View>
  );
}

/** The same game again; whatever is dealt at the start is dealt again. */
function rematch(card: MatchCard): string {
  const { typeId, settings, players } = card.game.session;
  const game = PRESETS[presetOf(typeId, settings)].game;
  return startGame(game, deal(game, settings as Record<string, unknown>, players), players);
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
    minHeight: 52,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.radii.m,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: theme.spacing.s, marginTop: theme.spacing.xs },
  link: {
    minHeight: 36,
    paddingHorizontal: theme.spacing.m,
    borderRadius: theme.radii.s,
    backgroundColor: theme.colors.surface2,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
}));
