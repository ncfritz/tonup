import { useEffect } from 'react';

import { botThrow, type Rng } from '@/domain/bot';
import { games } from '@/domain/games';

import { botUp, useGame } from './store';

/** Pause before each bot dart, so players see them land one at a time. */
const FIRST_DART_MS = 900;
const NEXT_DART_MS = 650;

const random: Rng = Math.random;

/** Plays the bot's darts while a bot is at the oche (and the leg summary isn't showing). */
export function useBotTurns(paused: boolean) {
  const game = useGame((s) => s.game);
  const legPause = useGame((s) => s.legPause);
  const level = botUp(game);
  useEffect(() => {
    if (!game || level === null || legPause || paused) return;
    const visit = game.state.visits[game.state.visits.length - 1];
    const midVisit = visit && !visit.done && visit.darts.length > 0;
    const timer = setTimeout(
      () => {
        const current = useGame.getState().game;
        if (!current || botUp(current) === null) return;
        const t = botThrow(games.x01, current.state, level, random);
        if (t)
          useGame
            .getState()
            .throwDart({ hit: t.hit, point: t.point, source: 'bot', intended: t.intended });
      },
      midVisit ? NEXT_DART_MS : FIRST_DART_MS,
    );
    return () => clearTimeout(timer);
  }, [game, level, legPause, paused]);
}
