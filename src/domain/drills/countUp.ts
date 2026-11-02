// Count Up (docs/research/training.md → Scoring): a fixed number of visits, as many points as
// you can.
import type { DartEvent, PlayerRef, Target } from '../darts';
import type { GameVisit, ScoreboardView, StatLine } from '../games/types';
import { addDart, checkPlayer } from '../games/visits';

import type { DrillDefinition, DrillStep } from './types';

export interface CountUpSettings {
  visits: number;
}

export const COUNT_UP_DEFAULTS: CountUpSettings = { visits: 8 };

export interface CountUpState {
  settings: CountUpSettings;
  player: PlayerRef;
  score: number;
  visits: GameVisit[];
  over: boolean;
}

function init(settings: CountUpSettings, players: PlayerRef[]): CountUpState {
  if (players.length !== 1) throw new RangeError('Count Up is for one player');
  return { settings, player: players[0]!, score: 0, visits: [], over: false };
}

function applyDart(state: CountUpState, dart: DartEvent): CountUpState {
  if (state.over) throw new Error('The drill is over');
  checkPlayer(state.player.id, dart);
  const visits = addDart(state.visits, 0, dart, dart.hit.score);
  const done = visits.filter((v) => v.done).length;
  return {
    ...state,
    visits,
    score: state.score + dart.hit.score,
    over: done === state.settings.visits,
  };
}

const targetFor = (s: CountUpState): Target | null =>
  s.over ? null : { segment: 20, multiplier: 3 };

function steps(s: CountUpState): DrillStep[] {
  return Array.from({ length: s.settings.visits }, (_, i) => {
    const v = s.visits[i];
    return {
      label: String(i + 1),
      state: v?.done
        ? 'done'
        : i === s.visits.filter((x) => x.done).length && !s.over
          ? 'current'
          : 'todo',
      value: v?.done ? v.total : undefined,
    };
  });
}

function view(s: CountUpState): ScoreboardView {
  const last = s.visits[s.visits.length - 1];
  const done = s.visits.filter((v) => v.done).length;
  return {
    rows: [
      {
        playerId: s.player.id,
        name: s.player.name,
        score: s.score,
        legs: 0,
        sets: 0,
        active: !s.over,
      },
    ],
    visit: last
      ? {
          playerId: s.player.id,
          darts: last.darts.map((d) => d.hit),
          total: last.total,
          bust: false,
        }
      : { playerId: s.player.id, darts: [], total: 0, bust: false },
    status: s.over ? { kind: 'matchWon', playerId: s.player.id } : { kind: 'playing' },
    set: 0,
    leg: 0,
    round: { n: Math.min(done + 1, s.settings.visits), of: s.settings.visits },
  };
}

function stats(s: CountUpState): StatLine[] {
  const darts = s.visits.reduce((n, v) => n + v.darts.length, 0);
  return [
    { key: 'drillScore', value: s.score, format: 'int' },
    { key: 'average', value: darts ? (s.score / darts) * 3 : 0, format: 'one' },
    { key: 'bestVisit', value: Math.max(0, ...s.visits.map((v) => v.total)), format: 'int' },
  ];
}

export const countUp: DrillDefinition<CountUpSettings, CountUpState> = {
  id: 'countUp',
  skill: 'scoring',
  better: 'higher',
  defaults: COUNT_UP_DEFAULTS,
  init,
  applyDart,
  currentPlayer: (s) => (s.over ? null : s.player),
  view,
  targetFor,
  result: (s) => (s.over ? { winnerId: s.player.id, score: { [s.player.id]: s.score } } : null),
  visits: (s) => s.visits,
  stats,
  score: (s) => s.score,
  steps,
  failed: () => false,
};
