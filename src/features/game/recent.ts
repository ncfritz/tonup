// What the Play home shows about recent games (docs/design/screens.md → Play).
import type { PlayerRef } from '@/domain/darts';
import type { ScoreboardRow, StatLine } from '@/domain/games';
import type { X01Stats } from '@/domain/stats';
import { latestFinished, latestUnfinished } from '@/services/db/sessionsRepo';

import { YOU_ID } from './lineup';
import { loadGame, sessionStats, sessionX01Stats, type LoadedGame } from './session';

export interface MatchCard {
  sessionId: string;
  typeId: string;
  settings: unknown;
  endedAt: number;
  /** The player the card is about: you, or the first person if you didn't play. */
  me: PlayerRef;
  opponents: PlayerRef[];
  won: boolean;
  draw: boolean;
  /** X01: "3–1", legs (or sets) for me, then the best opponent. Other games: null. */
  score: string | null;
  /** X01 stats for the card's line; null for other games. */
  stats: X01Stats | null;
  /** The game's own first summary line, for other games. */
  line: StatLine | null;
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
  const result = game.def.result(game.state);
  if (!result) return null;
  const players = game.session.players;
  const me = meOf(players);
  const opponents = players.filter((p) => p.id !== me.id);
  const isX01 = game.session.typeId === 'x01';
  const mine = result.score[me.id] ?? 0;
  const best = Math.max(0, ...opponents.map((p) => result.score[p.id] ?? 0));
  return {
    sessionId: id,
    typeId: game.session.typeId,
    settings: game.session.settings,
    endedAt: game.session.endedAt ?? game.session.startedAt,
    me,
    opponents,
    won: result.winnerId === me.id,
    draw: result.winnerId === null,
    score: isX01 ? (opponents.length ? `${mine}–${best}` : `${mine}`) : null,
    stats: isX01 ? sessionX01Stats(game, me.id) : null,
    line: isX01 ? null : (sessionStats(game, me.id)[0] ?? null),
    game,
  };
}

export interface ResumeCard {
  sessionId: string;
  typeId: string;
  settings: unknown;
  rows: ScoreboardRow[];
}

export function resumable(): ResumeCard | null {
  const id = latestUnfinished('game');
  if (!id) return null;
  const game = loadGame(id);
  return {
    sessionId: id,
    typeId: game.session.typeId,
    settings: game.session.settings,
    rows: game.def.view(game.state).rows,
  };
}
