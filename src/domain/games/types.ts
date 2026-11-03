// The shape every game follows (ADR 0006, docs/plan/v1-implementation.md §3). A game is a pure
// reducer over its darts: undo, editing a dart and replay are all a refold of the event list.
import type { DartEvent, Hit, PlayerRef, Target } from '../darts';

export type GameId =
  | 'x01'
  | 'cricket'
  | 'clock'
  | 'shanghai'
  | 'killer'
  | 'gotcha'
  | 'fives'
  | 'countUp'
  | 'halveIt'
  | 'hareHounds'
  | 'scam'
  | 'baseball'
  | 'golf'
  | 'football'
  | 'ticTacToe';
export type GameFamily = 'x01' | 'cricket' | 'sequence' | 'elimination' | 'sports';

/** One player's row on the scoreboard. */
export interface ScoreboardRow {
  playerId: string;
  name: string;
  /** The big number: X01 remaining, cricket points, lives… */
  score: number;
  /** Legs won in the current set (or the match without sets); 0 in single-game games. */
  legs: number;
  sets: number;
  active: boolean;
  /** A short line under the name: "On 7", "Killer · 14", "Out". */
  note?: string;
  /** Out of the game (Killer, Nine Lives). */
  out?: boolean;
  /** Lives left, in games that have them. */
  lives?: number;
}

/** Cricket's marks grid: rows are the numbers, columns the players. */
export interface CricketDetail {
  kind: 'cricket';
  /** 20…15 and 25 for the bull. */
  numbers: number[];
  /** marks[player][number index], capped at 3 for display. */
  marks: number[][];
  /** A number closed by everyone, so it no longer scores. */
  dead: boolean[];
  /** False in No-Score Cricket, which has no points row. */
  points: boolean;
}

/** Tic-Tac-Toe's grid: nine targets and who has claimed each. */
export interface GridDetail {
  kind: 'grid';
  /** Target codes, row by row (25 is the bull). */
  cells: number[];
  /** The player index that claimed each cell, or null. */
  owner: (number | null)[];
}

export type ScoreDetail = CricketDetail | GridDetail;

export type ScoreboardStatus =
  | { kind: 'checkout'; route: Target[] }
  | { kind: 'noFinish' }
  | { kind: 'bust' }
  | { kind: 'legWon'; playerId: string }
  | { kind: 'matchWon'; playerId: string }
  | { kind: 'notOpened' }
  /** What to aim at, and why: the next number, the round's number, a Killer double… */
  | { kind: 'aim'; target: Target; reason: AimReason }
  | { kind: 'playing' };

export type AimReason =
  | 'clock'
  | 'shanghai'
  | 'killerQualify'
  | 'killerAttack'
  /** A game with one target per visit or inning: Halve-It, Baseball, Golf, Hare and Hounds. */
  | 'target'
  /** Football: win the ball on the bull, then score on doubles. */
  | 'possession'
  | 'goal'
  /** Scam: the stopper closes numbers, the scorer scores on open ones. */
  | 'stopper'
  | 'scorer';

export interface ScoreboardView {
  rows: ScoreboardRow[];
  /** The darts of the visit in progress (or the one just finished, until the next dart). */
  visit: { playerId: string; darts: Hit[]; total: number; bust: boolean };
  status: ScoreboardStatus;
  set: number;
  leg: number;
  /** Shanghai's round and similar; null where it doesn't apply. */
  round: { n: number; of: number } | null;
  detail?: ScoreDetail;
}

/** A visit as every game reports it, for the dart slots, replay and the caller. */
export interface GameVisit {
  player: number;
  darts: DartEvent[];
  /** What the visit scored in this game's terms (points, marks…). */
  total: number;
  bust: boolean;
  done: boolean;
  /** Leg within the match, from 0 (always 0 in single-game games). */
  leg: number;
  /** The visit that won a leg (X01 checkout). */
  endsLeg: boolean;
}

/** One line of the summary table; the label is `game:stats.<key>`. */
export interface StatLine {
  key: string;
  value: number | null;
  format: 'int' | 'one' | 'pct';
}

export interface GameResult {
  /** Null for a draw (Shanghai can tie). */
  winnerId: string | null;
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
  visits(state: State): GameVisit[];
  /** Per-player stats for the summary. */
  stats(state: State, playerId: string): StatLine[];
}
