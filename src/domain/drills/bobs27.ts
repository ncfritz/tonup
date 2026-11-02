// Bob's 27 (docs/research/training.md → Doubles): start on 27, three darts at each double from
// D1 to D20 and then the bull. Each hit adds the double's value; a round with no hits takes it
// away. At zero or below the drill is over.
import { BULL, label, type DartEvent, type PlayerRef, type Target } from '../darts';
import type { GameVisit, ScoreboardView, StatLine } from '../games/types';
import { addDart, checkPlayer } from '../games/visits';

import type { DrillDefinition, DrillStep } from './types';

export type Bobs27Settings = Record<string, never>;

export const BOBS27_TARGETS = [...Array.from({ length: 20 }, (_, i) => i + 1), BULL];
const value = (n: number) => (n === BULL ? 50 : n * 2);

export interface Bobs27State {
  player: PlayerRef;
  score: number;
  /** Round in play, from 0 (D1); 21 when finished. */
  round: number;
  /** Hits in each finished round. */
  hits: number[];
  visits: GameVisit[];
  over: boolean;
  failed: boolean;
}

function init(_s: Bobs27Settings, players: PlayerRef[]): Bobs27State {
  if (players.length !== 1) throw new RangeError("Bob's 27 is for one player");
  return {
    player: players[0]!,
    score: 27,
    round: 0,
    hits: [],
    visits: [],
    over: false,
    failed: false,
  };
}

function applyDart(state: Bobs27State, dart: DartEvent): Bobs27State {
  if (state.over) throw new Error('The drill is over');
  checkPlayer(state.player.id, dart);
  const n = BOBS27_TARGETS[state.round]!;
  const hit = dart.hit.segment === n && dart.hit.isDouble;
  const visits = addDart(state.visits, 0, dart, hit ? value(n) : 0);
  const visit = visits[visits.length - 1]!;
  if (!visit.done) return { ...state, visits };
  const hits = visit.darts.filter((d) => d.hit.segment === n && d.hit.isDouble).length;
  const score = hits ? state.score + hits * value(n) : state.score - value(n);
  const round = state.round + 1;
  const failed = score <= 0;
  const over = failed || round === BOBS27_TARGETS.length;
  return { ...state, visits, score, round, hits: [...state.hits, hits], over, failed };
}

const targetFor = (s: Bobs27State): Target | null =>
  s.over ? null : { segment: BOBS27_TARGETS[s.round]!, multiplier: 2 };

function steps(s: Bobs27State): DrillStep[] {
  return BOBS27_TARGETS.map((n, i) => ({
    label: label({ segment: n, multiplier: 2 }),
    state:
      i < s.hits.length
        ? s.hits[i]! > 0
          ? 'done'
          : 'missed'
        : i === s.round && !s.over
          ? 'current'
          : 'todo',
    value: i < s.hits.length ? (s.hits[i]! > 0 ? s.hits[i]! * value(n) : -value(n)) : undefined,
  }));
}

function view(s: Bobs27State): ScoreboardView {
  const last = s.visits[s.visits.length - 1];
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
    round: { n: Math.min(s.round + 1, BOBS27_TARGETS.length), of: BOBS27_TARGETS.length },
  };
}

function stats(s: Bobs27State): StatLine[] {
  const darts = s.visits.reduce((n, v) => n + v.darts.length, 0);
  const hit = s.hits.reduce((n, h) => n + h, 0);
  // The double that cost the most: the highest one missed with all three darts.
  const missed = s.hits.flatMap((h, i) => (h === 0 ? [BOBS27_TARGETS[i]!] : []));
  return [
    { key: 'drillScore', value: s.score, format: 'int' },
    { key: 'doublesRate', value: darts ? hit / darts : null, format: 'pct' },
    { key: 'roundsPlayed', value: s.hits.length, format: 'int' },
    { key: 'costliestDouble', value: missed.length ? Math.max(...missed) : null, format: 'int' },
  ];
}

export const bobs27: DrillDefinition<Bobs27Settings, Bobs27State> = {
  id: 'bobs27',
  skill: 'doubles',
  better: 'higher',
  defaults: {},
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
  failed: (s) => s.failed,
};
