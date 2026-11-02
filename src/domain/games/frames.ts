// Replay frames for any game (ADR 0006): after each visit, the scoreboard as it stood.
import type { DartEvent, PlayerRef } from '../darts';

import { x01Frames, type X01State } from './x01';
import type { GameDefinition, ScoreboardRow } from './types';

export interface ReplayFrame {
  index: number;
  set: number;
  leg: number;
  player: number;
  darts: DartEvent[];
  total: number;
  bust: boolean;
  endsLeg: boolean;
  /** Everyone's scoreboard row after this visit. */
  rows: ScoreboardRow[];
}

export interface ReplayLeg {
  leg: number;
  set: number;
  frames: ReplayFrame[];
}

/** Frames for a stored game, grouped by leg (single-game games have one). */
export function replayLegs(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): ReplayLeg[] {
  const frames =
    def.id === 'x01'
      ? x01ReplayFrames(def, settings, players, darts)
      : genericFrames(def, settings, players, darts);
  const legs: ReplayLeg[] = [];
  for (const f of frames) {
    const last = legs[legs.length - 1];
    if (last && last.leg === f.leg && last.set === f.set) last.frames.push(f);
    else legs.push({ leg: f.leg, set: f.set, frames: [f] });
  }
  return legs;
}

function x01ReplayFrames(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): ReplayFrame[] {
  let state = def.init(settings, players);
  for (const d of [...darts].sort((a, b) => a.seq - b.seq)) state = def.applyDart(state, d);
  // X01 scores reset at each leg, so its frames come from the visits themselves.
  return x01Frames(state as X01State).map((f) => ({
    index: f.index,
    set: f.set,
    leg: f.leg,
    player: f.player,
    darts: f.darts,
    total: f.scored,
    bust: f.bust,
    endsLeg: f.checkout,
    rows: players.map((p, i) => ({
      playerId: p.id,
      name: p.name,
      score: f.remaining[i]!,
      legs: 0,
      sets: 0,
      active: i === f.player,
    })),
  }));
}

function genericFrames(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  players: PlayerRef[],
  darts: readonly DartEvent[],
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  let state = def.init(settings, players);
  const ordered = [...darts].sort((a, b) => a.seq - b.seq);
  const snapshot = () => {
    const visits = def.visits(state);
    const v = visits[visits.length - 1]!;
    const rows = def.view(state).rows.map((r, i) => ({ ...r, active: i === v.player }));
    frames.push({
      index: visits.length - 1,
      set: 0,
      leg: v.leg,
      player: v.player,
      darts: v.darts,
      total: v.total,
      bust: v.bust,
      endsLeg: v.endsLeg,
      rows,
    });
  };
  ordered.forEach((d, i) => {
    state = def.applyDart(state, d);
    const visits = def.visits(state);
    const v = visits[visits.length - 1];
    if (v?.done || i === ordered.length - 1) snapshot();
  });
  return frames;
}
