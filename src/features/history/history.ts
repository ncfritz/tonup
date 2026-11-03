// The History tab (docs/design/screens.md → History): recent sessions, a trend, personal bests
// and where your darts land, all derived from stored darts (ADR 0006).
import { DRILL_IDS, type DrillId } from '@/domain/drills';
import type { GameResult } from '@/domain/games';
import { heatmap } from '@/domain/stats';
import { log } from '@/services/diagnostics';
import {
  dartsOf,
  deleteSession,
  finishedOfType,
  getSession,
  recentSessions,
} from '@/services/db/sessionsRepo';

import { YOU_ID } from '../game/lineup';
import { loadGame, sessionStats, sessionX01Stats, type LoadedGame } from '../game/session';
import { drillScores, personalBest } from '../practice/bests';

export type HistoryFilter = 'all' | 'matches' | 'practice';

export interface HistoryEntry {
  sessionId: string;
  kind: 'game' | 'drill';
  typeId: string;
  settings: unknown;
  at: number;
  finished: boolean;
  /** You won (games), or a new best at the time (drills isn't tracked here). */
  won: boolean | null;
  draw: boolean;
  opponents: string[];
  /** X01 legs score "3–1", a drill score, or null. */
  score: string | null;
  /** The headline number: X01 average, a drill score, the game's first stat. */
  stat: { key: string; value: number | null; format: 'int' | 'one' | 'pct' } | null;
}

const kindOf = (f: HistoryFilter) =>
  f === 'matches' ? 'game' : f === 'practice' ? 'drill' : undefined;

function entryOf(game: LoadedGame): HistoryEntry {
  const { session } = game;
  const result = session.result as GameResult | null;
  const me = session.players.find((p) => p.id === YOU_ID) ?? session.players[0]!;
  const opponents = session.players.filter((p) => p.id !== me.id).map((p) => p.name);
  const isX01 = session.typeId === 'x01' && session.kind === 'game';
  let score: string | null = null;
  if (result && isX01) {
    const best = Math.max(
      0,
      ...session.players.filter((p) => p.id !== me.id).map((p) => result.score[p.id] ?? 0),
    );
    score = opponents.length ? `${result.score[me.id] ?? 0}–${best}` : null;
  } else if (result && session.kind === 'drill') {
    score = String(result.score[me.id] ?? '');
  }
  const stat = isX01
    ? { key: 'average', value: sessionX01Stats(game, me.id).average, format: 'one' as const }
    : (sessionStats(game, me.id)[0] ?? null);
  return {
    sessionId: session.id,
    kind: session.kind,
    typeId: session.typeId,
    settings: session.settings,
    at: session.endedAt ?? session.startedAt,
    finished: session.endedAt !== null,
    won: result && opponents.length ? result.winnerId === me.id : null,
    draw: !!result && result.winnerId === null,
    opponents,
    score,
    stat,
  };
}

export function historyEntries(filter: HistoryFilter, limit = 30): HistoryEntry[] {
  return recentSessions(limit, kindOf(filter)).flatMap((id) => {
    try {
      return [entryOf(loadGame(id))];
    } catch {
      // A session for a game this build doesn't know: leave it out rather than fail the tab.
      return [];
    }
  });
}

/** Your 3-dart average over recent finished X01 matches, oldest first. */
export function x01Trend(limit = 20): number[] {
  return finishedOfType('game', 'x01', limit)
    .map((s) => sessionX01Stats(loadGame(s.id), YOU_ID))
    .filter((s) => s.darts > 0)
    .map((s) => s.average)
    .reverse();
}

/** A drill's scores, oldest first. */
export const drillTrend = (id: DrillId, limit = 20) =>
  drillScores(id, YOU_ID, limit)
    .map((s) => s.score)
    .reverse();

/** The drill with the most recent finished go, for the Practice trend. */
export function latestDrill(): DrillId | null {
  let best: { id: DrillId; at: number } | null = null;
  for (const id of DRILL_IDS) {
    const s = drillScores(id, YOU_ID, 1)[0];
    if (s && (!best || s.endedAt > best.at)) best = { id, at: s.endedAt };
  }
  return best?.id ?? null;
}

export interface Bests {
  bestAverage: { value: number; sessionId: string } | null;
  highCheckout: { value: number; sessionId: string } | null;
  drills: Partial<Record<DrillId, number>>;
}

export function bests(limit = 500): Bests {
  let bestAverage: Bests['bestAverage'] = null;
  let highCheckout: Bests['highCheckout'] = null;
  for (const s of finishedOfType('game', 'x01', limit)) {
    const st = sessionX01Stats(loadGame(s.id), YOU_ID);
    if (st.darts === 0) continue;
    if (!bestAverage || st.average > bestAverage.value)
      bestAverage = { value: st.average, sessionId: s.id };
    if (st.highestCheckout && (!highCheckout || st.highestCheckout > highCheckout.value)) {
      highCheckout = { value: st.highestCheckout, sessionId: s.id };
    }
  }
  const drills: Bests['drills'] = {};
  for (const id of DRILL_IDS) {
    const b = personalBest(id);
    if (b) drills[id] = b.score;
  }
  return { bestAverage, highCheckout, drills };
}

/** Where your darts landed across the sessions shown. */
export function historyHeatmap(filter: HistoryFilter, sessions = 30) {
  const ids = recentSessions(sessions, kindOf(filter));
  return heatmap(dartsOf(YOU_ID, ids).map((d) => d.hit));
}

/** Where tapping a session goes: unfinished ones resume, finished ones open the replay. */
export function destination(sessionId: string): {
  pathname: '/game/[sessionId]' | '/drill/[sessionId]' | '/replay/[sessionId]';
  params: { sessionId: string };
} | null {
  const s = getSession(sessionId);
  if (!s) return null;
  if (s.endedAt === null) {
    return {
      pathname: s.kind === 'drill' ? '/drill/[sessionId]' : '/game/[sessionId]',
      params: { sessionId },
    };
  }
  return { pathname: '/replay/[sessionId]', params: { sessionId } };
}

/** Deletes a game or drill and its darts for good; stats, bests and trends follow from what's left. */
export function removeSession(sessionId: string) {
  deleteSession(sessionId);
  log('info', 'deleted session');
}
