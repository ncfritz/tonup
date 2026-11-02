// Around the Clock as a drill (docs/research/training.md → Accuracy): the game on your own,
// scored by darts to finish (fewer is better).
import { BULL } from '../darts';
import {
  clock as clockGame,
  clockSequence,
  type ClockSettings,
  type ClockState,
} from '../games/clock';
import type { StatLine } from '../games/types';

import type { DrillDefinition, DrillStep } from './types';

const darts = (s: ClockState) => s.visits.reduce((n, v) => n + v.darts.length, 0);

function steps(s: ClockState): DrillStep[] {
  const at = s.next[0]!;
  return clockSequence(s.settings).map((n, i) => ({
    label: n === BULL ? 'Bull' : String(n),
    state: i < at ? 'done' : i === at && s.winner === null ? 'current' : 'todo',
  }));
}

function stats(s: ClockState): StatLine[] {
  const d = darts(s);
  const hits = s.visits.reduce((n, v) => n + v.total, 0);
  return [
    { key: 'dartsToFinish', value: d, format: 'int' },
    { key: 'hitRate', value: d ? hits / d : null, format: 'pct' },
  ];
}

export const clockDrill: DrillDefinition<ClockSettings, ClockState> = {
  ...clockGame,
  id: 'clock',
  skill: 'accuracy',
  better: 'lower',
  init: (settings, players) => {
    if (players.length !== 1) throw new RangeError('The Around the Clock drill is for one player');
    return clockGame.init(settings, players);
  },
  result: (s) =>
    s.winner === null
      ? null
      : { winnerId: s.players[0]!.id, score: { [s.players[0]!.id]: darts(s) } },
  stats,
  score: darts,
  steps,
  failed: () => false,
};
