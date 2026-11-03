import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';

import { drawPoint } from '@/domain/board';
import { beats, drills } from '@/domain/drills';
import { label, type PlayerRef } from '@/domain/darts';
import type { GameId } from '@/domain/games';
import type { X01Settings } from '@/domain/games/x01';
import { formatStat, gameName, rowFormat } from '@/features/game/format';
import { bestOf, botId, YOU_ID } from '@/features/game/lineup';
import { deal, isPresetId, PRESETS, presetOf, settingsFor } from '@/features/game/presets';
import { lastMatch, resumable, type MatchCard, type ResumeCard } from '@/features/game/recent';
import { startDrill, startGame } from '@/features/game/session';
import { lastPractice, type PracticeCard } from '@/features/practice/bests';
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
  const [practice, setPractice] = useState<PracticeCard | null>(null);
  useFocusEffect(
    useCallback(() => {
      setResume(resumable());
      setMatch(lastMatch());
      setPractice(lastPractice());
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
        {(['x01', 'cricket', 'killer'] as const).map((g) => (
          <Shortcut
            key={g}
            label={tg(`home.shortcut.${g}`)}
            onPress={() => router.push({ pathname: '/new-game', params: { game: g } })}
          />
        ))}
        <Shortcut label={tg('home.allGames')} onPress={() => router.push('/new-game')} />
      </View>
      <Text variant="overline" tone="muted">
        {tg('home.pickUp')}
      </Text>
      <LastMatchView card={match} now={now} />
      <LastPractice card={practice} now={now} />
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

function LastPractice({ card, now }: { card: PracticeCard | null; now: number }) {
  const { t } = useTranslation('game');
  const { t: tp } = useTranslation('practice');
  const { theme } = useUnistyles();
  if (!card) {
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
  const drill = drills[card.drillId];
  const when = dayLabel(card.endedAt, now, {
    today: t('home.today'),
    yesterday: t('home.yesterday'),
  });
  const b = card.best;
  const versus = !b
    ? tp('home.first')
    : beats(drill.better, card.score, b.score)
      ? tp('home.best')
      : card.score === b.score
        ? tp('home.level')
        : tp('home.short', { gap: Math.abs(card.score - b.score), best: b.score });
  const again = () => {
    const id = startDrill(card.drillId, card.game.session.settings, {
      id: YOU_ID,
      name: t('players.you'),
    });
    router.push({ pathname: '/drill/[sessionId]', params: { sessionId: id } });
  };
  return (
    <View style={[styles.card, styles.row]}>
      <Trend
        values={card.trend}
        color={theme.colors.accent}
        line={theme.colors.line}
        label={tp('home.trendA11y', {
          drill: tp(`drills.${card.drillId}.name` as 'drills.bobs27.name'),
        })}
      />
      <View style={styles.flex}>
        <Text variant="overline" tone="muted">
          {tp('home.lastPractice', { when })}
        </Text>
        <Text variant="title">
          {tp('home.title', {
            drill: tp(`drills.${card.drillId}.name` as 'drills.bobs27.name'),
            score: card.score,
          })}
        </Text>
        <Text variant="caption" tone="muted">
          {card.costliest !== null
            ? `${versus} · ${tp('home.costliest', { double: label({ segment: card.costliest, multiplier: 2 }) })}`
            : versus}
        </Text>
        <View style={styles.actions}>
          <SmallLink label={tp('home.tryAgain')} onPress={again} />
          <SmallLink label={t('home.allDrills')} onPress={() => router.navigate('/practice')} />
        </View>
      </View>
    </View>
  );
}

/** A tiny line of recent scores. */
function Trend({
  values,
  color,
  line,
  label: a11y,
}: {
  values: number[];
  color: string;
  line: string;
  label: string;
}) {
  const W = 84;
  const H = 84;
  const pad = 10;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (values.length - 1);
    const y = H - pad - ((v - min) / span) * (H - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <Svg width={W} height={H} accessible accessibilityLabel={a11y}>
      <Rect x={0} y={0} width={W} height={H} rx={10} fill={line} opacity={0.25} />
      {pts.length > 1 ? (
        <Polyline
          points={pts.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <Circle cx={W / 2} cy={H / 2} r={4} fill={color} />
      )}
    </Svg>
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
