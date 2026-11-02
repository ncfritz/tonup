// Replay frames for X01 (ADR 0006): one frame per visit, with everyone's score after it, read
// straight from the folded game so replay can't disagree with what happened.
import type { DartEvent } from '../../darts';

import type { X01State } from './x01';

export interface X01Frame {
  /** Index of the visit in the whole match. */
  index: number;
  set: number;
  leg: number;
  player: number;
  darts: DartEvent[];
  scored: number;
  bust: boolean;
  checkout: boolean;
  /** Each player's score left after this visit, in this leg. */
  remaining: number[];
}

export function x01Frames(state: X01State): X01Frame[] {
  const start = state.settings.startScore;
  const frames: X01Frame[] = [];
  let leg = -1;
  let remaining: number[] = [];
  state.visits.forEach((v, index) => {
    if (v.leg !== leg) {
      leg = v.leg;
      remaining = state.players.map(() => start);
    }
    remaining = [...remaining];
    remaining[v.player] = v.bust ? v.before[0]! : v.before[0]! - v.scored;
    frames.push({
      index,
      set: v.set,
      leg: v.leg,
      player: v.player,
      darts: v.darts,
      scored: v.bust ? 0 : v.scored,
      bust: v.bust,
      checkout: v.checkout,
      remaining,
    });
  });
  return frames;
}

/** The legs played, in order, each with its frames. */
export function x01Legs(state: X01State): { leg: number; set: number; frames: X01Frame[] }[] {
  const legs: { leg: number; set: number; frames: X01Frame[] }[] = [];
  for (const f of x01Frames(state)) {
    const last = legs[legs.length - 1];
    if (last && last.leg === f.leg) last.frames.push(f);
    else legs.push({ leg: f.leg, set: f.set, frames: [f] });
  }
  return legs;
}
