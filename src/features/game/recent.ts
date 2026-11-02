// What the Play home shows about recent games (docs/design/screens.md → Play).
import type { PlayerRef } from '@/domain/darts';
import { games } from '@/domain/games';
import type { X01Stats } from '@/domain/stats';
import { latestFinished, latestUnfinished } from '@/services/db/sessionsRepo';

import { YOU_ID } from './lineup';
import { loadGame, sessionX01Stats, type LoadedGame } from './session';

export interface MatchCard {
  sessionId: string;
  endedAt: number;
  startScore: number;
  /** The player the card is about: you, or the first person if you didn't play. */
  me: PlayerRef;
  opponents: PlayerRef[];
  won: boolean;
  /** "3–1": legs (or sets) for me, then the best opponent. */
  score: string;
  stats: X01Stats;
  game: LoadedGame;
}

function meOf(players: PlayerRef[]): PlayerRef {
  return (
    players.find((p) => p.id === YOU_ID) ??
    players.find((p) => p.botLevel === undefined) ??
    players[0]!
  );
}

export function lastMatch(): MatchCard | null {
  const id = latestFinished('game');
  if (!id) return null;
  const game = loadGame(id);
  const result = games.x01.result(game.state);
  if (!result) return null;
  const players = game.session.players;
  const me = meOf(players);
  const opponents = players.filter((p) => p.id !== me.id);
  const mine = result.score[me.id] ?? 0;
  const best = Math.max(0, ...opponents.map((p) => result.score[p.id] ?? 0));
  return {
    sessionId: id,
    endedAt: game.session.endedAt ?? game.session.startedAt,
    startScore: game.state.settings.startScore,
    me,
    opponents,
    won: result.winnerId === me.id,
    score: opponents.length ? `${mine}–${best}` : `${mine}`,
    stats: sessionX01Stats(game, me.id),
    game,
  };
}

export interface ResumeCard {
  sessionId: string;
  startScore: number;
  players: PlayerRef[];
  remaining: number[];
}

export function resumable(): ResumeCard | null {
  const id = latestUnfinished('game');
  if (!id) return null;
  const game = loadGame(id);
  return {
    sessionId: id,
    startScore: game.state.settings.startScore,
    players: game.session.players,
    remaining: game.state.remaining,
  };
}
