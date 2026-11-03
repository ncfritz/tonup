// Drills (docs/research/training.md): solo practice with a score and a personal best. A drill is
// a game definition (pure, folded from darts, ADR 0006) plus how it is scored.
import type { Rng } from '../bot/rng';
import type { GameDefinition } from '../games/types';

export type DrillId =
  | 'bobs27'
  | 'countUp'
  | 'clock'
  | 't20'
  | 'halveIt'
  | 'shanghai'
  | 'bullseye'
  | 'checkouts'
  | 'doublesLock'
  | 'catch40'
  | 'oneTwentyOne'
  | 'hubbe'
  | 'randomCheckout'
  | 'oneSeventy'
  | 'jdc'
  | 'assessment'
  | 'pressure';
/** What a drill works on; the Practice tab groups drills by it. */
export type Skill = 'scoring' | 'accuracy' | 'doubles' | 'checkouts' | 'assessment';

/** One step of the progress strip: a round of Bob's 27, a visit of Count Up, a number. */
export interface DrillStep {
  /** "D16", "Bull", "Visit 3", "7". */
  label: string;
  state: 'done' | 'missed' | 'current' | 'todo';
  /** What the step scored or cost, where that means something. */
  value?: number;
}

/** What the drill screen shows above the strip, besides the target. */
export type DrillPrompt =
  /** A checkout to finish: "Finish 87 · 6 darts". */
  | { kind: 'finish'; remaining: number; dartsLeft: number }
  /** Pressure: the bot is on a finish, you have one visit. */
  | { kind: 'pressure'; remaining: number; dartsLeft: number; botOn: number }
  /** The assessment's part in play. */
  | { kind: 'part'; part: 'scoring' | 'doubles' | 'checkouts'; remaining?: number };

export interface DrillDefinition<Settings, State> extends Omit<
  GameDefinition<Settings, State>,
  'id' | 'family'
> {
  id: DrillId;
  skill: Skill;
  /** Higher is better (Bob's 27, Count Up) or lower (darts to finish Around the Clock). */
  better: 'higher' | 'lower';
  /** The score so far, and the final score once the drill is over. */
  score(state: State): number;
  steps(state: State): DrillStep[];
  /** Whether the drill ended early (Bob's 27 at zero). */
  failed(state: State): boolean;
  /** Draws what a drill deals at the start (Random Checkout's targets). */
  deal?(settings: Settings, rng: Rng): Settings;
  prompt?(state: State): DrillPrompt | null;
}
