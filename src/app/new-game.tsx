import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useRulesT } from '@/content/rules';
import { BOT_LEVELS } from '@/domain/bot';
import type { PlayerRef } from '@/domain/darts';
import type { GameId } from '@/domain/games';
import { canPlayRules } from '@/domain/pro';
import { bestOf, botId, isBot, MAX_PLAYERS, newGuest, YOU_ID } from '@/features/game/lineup';
import { deal, isPresetId, PRESETS, settingsFor, type PresetId } from '@/features/game/presets';
import { startGame } from '@/features/game/session';
import { GamePicker } from '@/features/newgame/GamePicker';
import { GameSetup, type LineupActions } from '@/features/newgame/GameSetup';
import { optionCards } from '@/features/newgame/options';
import { recentSetups, type Setup } from '@/features/newgame/recent';
import { useProOwned } from '@/features/pro/pro';
import { useSettings } from '@/features/settings/store';
import { Header, Screen } from '@/ui';

type Settings = Record<string, unknown>;

/**
 * New game in two steps (docs/design/screens.md → New game): choose the game, then set it up.
 * Home's shortcuts, Play again and the rules pages open straight on step 2 for their game.
 */
export default function NewGame() {
  const { t } = useTranslation('game');
  const tl = t as unknown as (k: string, o?: Record<string, unknown>) => string;
  const rt = useRulesT();
  const proOwned = useProOwned();
  const saved = useSettings((s) => s.gameSettings);
  const lastLineup = useSettings((s) => s.lastLineup);
  const setSetting = useSettings((s) => s.set);
  const { game: asked } = useLocalSearchParams<{ game?: string }>();
  const [presetId, setPresetId] = useState<PresetId | null>(
    isPresetId(asked) && canPlayRules(asked, proOwned) ? asked : null,
  );
  // Settings being edited, per game engine; a preset's fixed settings always apply on top.
  const [edits, setEdits] = useState<Partial<Record<GameId, Settings>>>({});
  const [players, setPlayers] = useState<PlayerRef[]>(
    lastLineup ?? [
      { id: YOU_ID, name: t('players.you') },
      { id: botId(3), name: t('players.bot', { level: 3 }), botLevel: 3 },
    ],
  );
  const recent = useMemo(() => recentSetups(), []);

  const lineup: LineupActions = {
    rename: (i, name) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, name } : p))),
    remove: (i) => setPlayers((ps) => ps.filter((_, j) => j !== i)),
    earlier: (i) =>
      setPlayers((ps) => {
        if (i < 1) return ps;
        const next = [...ps];
        [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
        return next;
      }),
    addGuest: () => setPlayers((ps) => [...ps, newGuest(t('players.guest', { n: ps.length + 1 }))]),
    addBot: () =>
      setPlayers((ps) => {
        // A level not already playing, so each bot is its own player.
        const used = new Set(ps.filter(isBot).map((p) => p.botLevel));
        const level = BOT_LEVELS.find((l) => !used.has(l.level))?.level;
        if (level === undefined) return ps;
        return [...ps, { id: botId(level), name: t('players.bot', { level }), botLevel: level }];
      }),
    level: (i, delta) =>
      setPlayers((ps) => {
        const p = ps[i]!;
        const level = (p.botLevel ?? 3) + delta;
        if (level < 1 || level > BOT_LEVELS.length) return ps;
        if (ps.some((q, j) => j !== i && q.botLevel === level)) return ps;
        return ps.map((q, j) =>
          j === i ? { id: botId(level), name: t('players.bot', { level }), botLevel: level } : q,
        );
      }),
  };

  const pickLocked = () => router.push('/pro');
  const again = (s: Setup) => {
    const game = PRESETS[s.presetId].game;
    setEdits((e) => ({ ...e, [game]: s.settings }));
    setPlayers(s.players);
    setPresetId(s.presetId);
  };
  const describe = (s: Setup) => {
    const others = s.players.filter((p) => p.id !== YOU_ID).map((p) => p.name);
    const vs = others.length
      ? t('newGame.againVs', { names: others.join(', ') })
      : t('newGame.againSolo');
    const legs =
      s.presetId === 'x01' && typeof s.settings.legs === 'number' ? s.settings.legs : null;
    return legs ? `${t('newGame.legs', { count: bestOf(legs) })} · ${vs}` : vs;
  };

  if (presetId === null) {
    return (
      <Screen scroll edges={['top', 'bottom']}>
        <Header
          title={t('newGame.step1')}
          backLabel={t('edit.close')}
          onBack={() => router.back()}
        />
        <GamePicker
          proOwned={proOwned}
          recent={recent}
          describe={describe}
          onPick={setPresetId}
          onAgain={again}
          onLocked={pickLocked}
        />
      </Screen>
    );
  }

  const preset = PRESETS[presetId];
  const game: GameId = preset.game;
  const settings: Settings = {
    ...settingsFor(presetId, saved[game]),
    ...edits[game],
    ...preset.fixed,
  };
  const set = (patch: Settings) =>
    setEdits((e) => ({
      ...e,
      [game]: { ...settingsFor(presetId, saved[game]), ...e[game], ...patch },
    }));
  const { cards, notes } = optionCards(presetId, game, settings, set, tl);
  const name = rt.t(`games.${presetId}.name`);
  const max = Math.min(MAX_PLAYERS, preset.players.max);
  const count = players.length;
  const wrongCount = count < preset.players.min || count > preset.players.max;
  const countError = !wrongCount
    ? null
    : preset.players.min === preset.players.max
      ? t('newGame.exactly', { count: preset.players.min, game: name })
      : count > preset.players.max
        ? t('newGame.atMost', { count: preset.players.max, game: name })
        : t('newGame.atLeast', { count: preset.players.min, game: name });

  const start = () => {
    const ready = players.map((p, i) => ({
      ...p,
      name: p.name.trim() || t('players.guest', { n: i + 1 }),
    }));
    // Saved without what's dealt at the start (Killer numbers, Random Cricket's six).
    const { numbers: _dealt, ...keep } = settings;
    void _dealt;
    setSetting('lastGameId', presetId);
    setSetting('gameSettings', { ...saved, [game]: keep });
    setSetting('lastLineup', ready);
    const id = startGame(game, deal(game, keep, ready), ready);
    router.replace({ pathname: '/game/[sessionId]', params: { sessionId: id } });
  };

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header
        title={t('newGame.step2')}
        backLabel={t('newGame.backToGames')}
        onBack={() => setPresetId(null)}
      />
      <GameSetup
        presetId={presetId}
        players={players}
        lineup={lineup}
        max={max}
        cards={cards}
        notes={notes}
        countError={countError}
        canStart={!wrongCount && canPlayRules(presetId, proOwned)}
        onStart={start}
        onChangeGame={() => setPresetId(null)}
        onRules={() => router.push({ pathname: '/rules/[gameId]', params: { gameId: presetId } })}
      />
    </Screen>
  );
}
