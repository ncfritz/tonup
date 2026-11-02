// Personal bests, recent scores and the suggested drill (docs/design/screens.md → Practice).
import { beats, drillFor, DRILL_IDS, type DrillId } from '@/domain/drills';
import type { GameResult } from '@/domain/games';
import { finishedOfType, latestFinished } from '@/services/db/sessionsRepo';

import { loadGame, sessionStats, type LoadedGame } from '../game/session';
import { YOU_ID } from '../game/lineup';

export interface DrillScore {
  sessionId: string;
  endedAt: number;
  score: number;
}

/** Your finished scores for a drill, newest first. */
export function drillScores(id: DrillId, playerId = YOU_ID, limit = 500): DrillScore[] {
  return finishedOfType('drill', id, limit).flatMap((s) => {
    const score = (s.result as GameResult | null)?.score[playerId];
    return typeof score === 'number' ? [{ sessionId: s.id, endedAt: s.endedAt, score }] : [];
  });
}

/** Your best score for a drill, optionally leaving one session out (to spot a new best). */
export function personalBest(id: DrillId, except?: string, playerId = YOU_ID): DrillScore | null {
  const { better } = drillFor(id);
  let best: DrillScore | null = null;
  for (const s of drillScores(id, playerId)) {
    if (s.sessionId === except) continue;
    if (!best || beats(better, s.score, best.score)) best = s;
  }
  return best;
}

export function allBests(): Partial<Record<DrillId, DrillScore>> {
  const out: Partial<Record<DrillId, DrillScore>> = {};
  for (const id of DRILL_IDS) {
    const best = personalBest(id);
    if (best) out[id] = best;
  }
  return out;
}

export interface PracticeCard {
  game: LoadedGame;
  drillId: DrillId;
  score: number;
  best: DrillScore | null;
  /** Bob's 27: the highest double missed with all three darts. */
  costliest: number | null;
  /** Oldest first, for the little trend line. */
  trend: number[];
  endedAt: number;
}

export function lastPractice(): PracticeCard | null {
  const id = latestFinished('drill');
  if (!id) return null;
  const game = loadGame(id);
  const drillId = game.session.typeId as DrillId;
  const score = (game.session.result as GameResult | null)?.score[YOU_ID];
  if (typeof score !== 'number') return null;
  const lines = sessionStats(game, YOU_ID);
  return {
    game,
    drillId,
    score,
    best: personalBest(drillId, id),
    costliest: lines.find((l) => l.key === 'costliestDouble')?.value ?? null,
    trend: drillScores(drillId, YOU_ID, 12)
      .map((s) => s.score)
      .reverse(),
    endedAt: game.session.endedAt ?? game.session.startedAt,
  };
}

/**
 * The suggested drill: a simple rule over recent X01 games (docs/research/training.md). Low
 * checkout rate → Bob's 27; low scoring → Count Up; otherwise accuracy with Around the Clock.
 */
export function suggestedDrill(): {
  id: DrillId;
  reason: 'checkout' | 'scoring' | 'accuracy' | 'start';
} {
  const recent = finishedOfType('game', 'x01', 5);
  if (recent.length === 0) return { id: 'bobs27', reason: 'start' };
  let attempts = 0;
  let checkouts = 0;
  let points = 0;
  let darts = 0;
  for (const r of recent) {
    const lines = sessionStats(loadGame(r.id), YOU_ID);
    const rate = lines.find((l) => l.key === 'checkoutRate')?.value;
    const avg = lines.find((l) => l.key === 'average')?.value;
    if (typeof rate === 'number') {
      attempts += 1;
      checkouts += rate;
    }
    if (typeof avg === 'number' && avg > 0) {
      points += avg;
      darts += 1;
    }
  }
  if (attempts && checkouts / attempts < 0.25) return { id: 'bobs27', reason: 'checkout' };
  if (darts && points / darts < 45) return { id: 'countUp', reason: 'scoring' };
  return { id: 'clock', reason: 'accuracy' };
}
