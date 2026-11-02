// The shape every game follows (ADR 0006, docs/plan/v1-implementation.md §3). A game is a pure
// reducer over its darts: undo, editing a dart and replay are all a refold of the event list.
import type { DartEvent, Hit, PlayerRef, Target } from '../darts';

export type GameId = 'x01';
export type GameFamily = 'x01' | 'cricket' | 'sequence' | 'elimination' | 'sports';

/** One player's row on the scoreboard. */
export interface ScoreboardRow {
  playerId: string;
  name: string;
  /** The big number: X01 remaining, cricket points, lives… */
  score: number;
  /** Legs won in the current set (or the match without sets). */
  legs: number;
  sets: number;
  active: boolean;
}

export type ScoreboardStatus =
  | { kind: 'checkout'; route: Target[] }
  | { kind: 'noFinish' }
  | { kind: 'bust' }
  | { kind: 'legWon'; playerId: string }
  | { kind: 'matchWon'; playerId: string }
  | { kind: 'notOpened' }
  | { kind: 'playing' };

export interface ScoreboardView {
  rows: ScoreboardRow[];
  /** The darts of the visit in progress (or the one just finished, until the next dart). */
  visit: { playerId: string; darts: Hit[]; total: number; bust: boolean };
  status: ScoreboardStatus;
  set: number;
  leg: number;
}

export interface GameResult {
  winnerId: string;
  /** Sets (or legs, without sets) won by each player, by id. */
  score: Record<string, number>;
}

export interface GameDefinition<Settings, State> {
  id: GameId;
  family: GameFamily;
  defaults: Settings;
  init(settings: Settings, players: PlayerRef[]): State;
  /** Applies one dart, including busts and the end of a visit, leg or match. */
  applyDart(state: State, dart: DartEvent): State;
  /** Whose dart is next; null once the match is over. */
  currentPlayer(state: State): PlayerRef | null;
  view(state: State): ScoreboardView;
  /** What the current player should aim at: checkout route, hints, the bot's aim. */
  targetFor(state: State): Target | null;
  result(state: State): GameResult | null;
}
