// Drills that are a game played on your own: Halve-It Sprint and the Shanghai drill.
import { BULL, label } from '../darts';
import { ANY_DOUBLE, ANY_TREBLE } from '../games/cricket/cricket';
import { halveIt as halveItGame, type HalveItSettings, type HalveItState } from '../games/halveIt';
import {
  shanghai as shanghaiGame,
  type ShanghaiSettings,
  type ShanghaiState,
} from '../games/shanghai';

import { dartsThrown, onePlayer } from './kit';
import type { DrillDefinition } from './types';

const codeLabel = (code: number) =>
  code === ANY_DOUBLE ? 'D' : code === ANY_TREBLE ? 'T' : code === BULL ? 'Bull' : String(code);

/** Halve-It Sprint: one visit each at 20, 19, 18, 17, any double, any treble and the bull. */
export const halveItSprint: DrillDefinition<HalveItSettings, HalveItState> = {
  ...halveItGame,
  id: 'halveIt',
  skill: 'scoring',
  better: 'higher',
  defaults: { list: 'sprint' },
  init: (settings, players) => halveItGame.init(settings, [onePlayer(players, 'Halve-It Sprint')]),
  score: (s) => s.scores[0]!,
  steps: (s) =>
    s.targets.map((code, i) => {
      const v = s.visits[i];
      return {
        label: codeLabel(code),
        state: v?.done
          ? v.bust
            ? 'missed'
            : 'done'
          : i === s.step && !s.over
            ? 'current'
            : 'todo',
        value: v?.done ? v.total : undefined,
      };
    }),
  failed: () => false,
};

const shanghaisIn = (s: ShanghaiState) =>
  s.visits.filter((v, i) => {
    const rings = new Set(
      v.darts.filter((d) => d.hit.segment === i + 1).map((d) => d.hit.multiplier),
    );
    return rings.has(1) && rings.has(2) && rings.has(3);
  }).length;

/** The Shanghai drill: a visit at each number from 1 to 20, scored as Shanghai. */
export const shanghaiDrill: DrillDefinition<ShanghaiSettings, ShanghaiState> = {
  ...shanghaiGame,
  id: 'shanghai',
  skill: 'accuracy',
  better: 'higher',
  defaults: { rounds: 20, instantWin: false },
  init: (settings, players) =>
    shanghaiGame.init({ ...settings, instantWin: false }, [
      onePlayer(players, 'The Shanghai drill'),
    ]),
  stats: (s) => {
    const darts = dartsThrown(s.visits);
    const hits = s.visits.reduce(
      (n, v, i) => n + v.darts.filter((d) => d.hit.segment === i + 1).length,
      0,
    );
    return [
      { key: 'points', value: s.points[0]!, format: 'int' },
      { key: 'hitRate', value: darts ? hits / darts : null, format: 'pct' },
      { key: 'shanghais', value: shanghaisIn(s), format: 'int' },
    ];
  },
  score: (s) => s.points[0]!,
  steps: (s) =>
    Array.from({ length: s.settings.rounds }, (_, i) => {
      const v = s.visits[i];
      return {
        label: label({ segment: i + 1, multiplier: 1 }),
        state: v?.done
          ? v.total > 0
            ? 'done'
            : 'missed'
          : i === s.round - 1 && !s.over
            ? 'current'
            : 'todo',
        value: v?.done ? v.total : undefined,
      };
    }),
  failed: () => false,
};
