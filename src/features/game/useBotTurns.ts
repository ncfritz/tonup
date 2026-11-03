import { useEffect } from 'react';

import type { Rng } from '@/domain/bot';

import { botUp, useGame } from './store';
import { throwFor } from './throwFor';

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
    const visits = game.def.visits(game.state);
    const visit = visits[visits.length - 1];
    const midVisit = visit && !visit.done && visit.darts.length > 0;
    const timer = setTimeout(
      () => {
        const current = useGame.getState().game;
        if (!current || botUp(current) === null) return;
        const up = current.def.currentPlayer(current.state);
        if (!up) return;
        // Ghosts throw with their own fitted scatter (src/domain/analysis/ghost.ts).
        const t = throwFor(current.def, current.state, up, random);
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
