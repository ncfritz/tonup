// Drills (docs/research/training.md): solo practice with a score and a personal best. A drill is
// a game definition (pure, folded from darts, ADR 0006) plus how it is scored.
import type { GameDefinition } from '../games/types';

export type DrillId = 'bobs27' | 'countUp' | 'clock';
export type Skill = 'scoring' | 'accuracy' | 'doubles';

/** One step of the progress strip: a round of Bob's 27, a visit of Count Up, a number. */
export interface DrillStep {
  /** "D16", "Bull", "Visit 3", "7". */
  label: string;
  state: 'done' | 'missed' | 'current' | 'todo';
  /** What the step scored or cost, where that means something. */
  value?: number;
}

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
}
