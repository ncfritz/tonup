import { hitAt } from '../board';
import { hitOf, miss, type DartEvent, type Hit, type PlayerRef, type Target } from '../darts';
import { gameFor, replayLegs, type GameDefinition } from '../games';
import { CRICKET_DEFAULTS } from '../games/cricket';
import { X01_DEFAULTS } from '../games/x01';
import { dartFor } from '../games/testing';

import {
  addDays,
  closingGrid,
  days,
  doubleLadder,
  finishBands,
  longestRun,
  missedFinishes,
  missSplit,
  rangeBounds,
  rangeDays,
  roundTotals,
  startOfDay,
  streaks,
  targetRates,
  trend,
  visitBands,
  worm,
} from '.';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const T = (n: number) => hitOf(n, 3);
const D = (n: number) => hitOf(n, 2);
const S = (n: number) => hitOf(n, 1);
const M = miss();

/** Darts for a game, each by whoever is up. */
function play(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  ps: PlayerRef[],
  hits: Hit[],
) {
  let state = def.init(settings, ps);
  const darts: DartEvent[] = [];
  hits.forEach((hit, seq) => {
    const p = def.currentPlayer(state)!;
    const d = dartFor(p.id, seq, hit);
    darts.push(d);
    state = def.applyDart(state, d);
  });
  return darts;
}

const aimed = (hit: Hit, intended: Target, extra: Partial<DartEvent> = {}): DartEvent => ({
  ...dartFor('a', 0, hit),
  intended,
  ...extra,
});

describe('worm', () => {
  it('starts every line at the start and carries each player through the leg', () => {
    const def = gameFor('x01');
    const settings = { ...X01_DEFAULTS, startScore: 301, legs: 1 };
    const darts = play(def, settings, [A, B], [T(20), T(20), T(20), S(1), S(1), S(1)]);
    const leg = replayLegs(def, settings, [A, B], darts)[0]!;
    expect(worm([301, 301], leg.frames)).toEqual([
      [301, 121, 121],
      [301, 301, 298],
    ]);
  });
});

describe('visit bands', () => {
  it('counts visits into the histogram bands', () => {
    expect(visitBands([0, 26, 45, 60, 85, 100, 139, 140, 180, 180])).toEqual({
      under40: 2,
      forties: 1,
      sixties: 1,
      eighties: 1,
      ton: 2,
      ton40: 1,
      max: 2,
    });
  });
});

describe('target rates and the double ladder', () => {
  const darts = [
    aimed(D(16), { segment: 16, multiplier: 2 }),
    aimed(S(16), { segment: 16, multiplier: 2 }),
    aimed(S(8), { segment: 20, multiplier: 2 }),
    aimed(hitOf(25, 2), { segment: 25, multiplier: 2 }),
    aimed(T(20), { segment: 20, multiplier: 3 }),
    aimed(D(5), { segment: 5, multiplier: 1 }),
    aimed(D(20), { segment: 20, multiplier: 2 }, { source: 'bot' }),
  ];

  it('ranks doubles by hit rate, bull included, bots left out', () => {
    expect(doubleLadder(darts).map((r) => [r.segment, r.hits, r.darts])).toEqual([
      [25, 1, 1],
      [16, 1, 2],
      [20, 0, 1],
    ]);
  });

  it('takes any ring of a single target as a hit', () => {
    expect(targetRates(darts, 1)).toEqual([{ segment: 5, darts: 1, hits: 1, rate: 1 }]);
  });
});

describe('closing grid', () => {
  it('records the round each player closed each number', () => {
    const def = gameFor('cricket');
    const settings = { ...CRICKET_DEFAULTS, roundLimit: null };
    // Round 1: A closes 20, B a single 19. Round 2: A closes 19, B closes 20.
    const darts = play(def, settings, [A, B], [T(20), M, M, S(19), M, M, T(19), M, M, T(20)]);
    const g = closingGrid(def, settings, [A, B], darts)!;
    expect(g.numbers.slice(0, 2)).toEqual([20, 19]);
    expect(g.closed[0]!.slice(0, 2)).toEqual([1, 2]);
    expect(g.closed[1]!.slice(0, 2)).toEqual([2, null]);
    expect(g.rounds).toBe(2);
  });

  it('is null for games without a marks grid', () => {
    const def = gameFor('x01');
    expect(closingGrid(def, X01_DEFAULTS, [A], [])).toBeNull();
  });
});

describe('round totals', () => {
  it('lists each player’s visit totals in order', () => {
    const def = gameFor('cricket');
    const settings = { ...CRICKET_DEFAULTS, roundLimit: null };
    const darts = play(def, settings, [A, B], [T(20), S(20), M, S(19), M, M, T(19)]);
    const frames = replayLegs(def, settings, [A, B], darts)[0]!.frames;
    expect(roundTotals(frames, 2)).toEqual([[4, 3], [1]]);
  });
});

describe('miss split', () => {
  const t20 = { segment: 20, multiplier: 3 } as const;
  const at = (x: number, y: number): DartEvent => ({
    ...aimed(hitAt({ x, y }), t20),
    point: { x, y },
    precision: 'exact',
    source: 'tap',
  });

  it('sorts tapped darts at T20 into the bed, high, low and the numbers either side', () => {
    const darts = [
      at(0, 103), // treble
      at(0, 130), // outer single 20: high
      at(0, 60), // inner single 20: low
      at(-40, 120), // into the 5
      at(40, 120), // into the 1
      at(0, -100), // the 3, nowhere near
      { ...aimed(S(20), t20) }, // a keypad dart: no position, left out
    ];
    expect(missSplit(darts)).toEqual({
      counts: { bed: 1, high: 1, low: 1, left: 1, right: 1, other: 1 },
      total: 6,
    });
  });
});

describe('trend', () => {
  it('finds the best by the drill’s direction', () => {
    expect(trend([5, 9, 7])).toEqual({ best: 1, average: 7, recent: 7, last: 7 });
    expect(trend([30, 24, 28], 'lower').best).toBe(1);
    expect(trend([])).toEqual({ best: null, average: null, recent: null, last: null });
  });

  it('averages the last ten for the recent line', () => {
    const scores = [100, ...Array.from({ length: 10 }, () => 10)];
    expect(trend(scores).recent).toBe(10);
  });
});

describe('finish bands', () => {
  const attempts = [
    { target: 61, finished: true, darts: 3 },
    { target: 65, finished: false, darts: 6 },
    { target: 99, finished: false, darts: 6 },
    { target: 99, finished: false, darts: 6 },
    { target: 87, finished: true, darts: 5 },
    { target: 87, finished: false, darts: 6 },
  ];

  it('groups attempts by band with darts per finish', () => {
    expect(finishBands(attempts)).toEqual([
      { lo: 61, hi: 80, attempts: 2, finished: 1, dartsPerFinish: 3 },
      { lo: 81, hi: 100, attempts: 4, finished: 1, dartsPerFinish: 5 },
    ]);
  });

  it('lists the finishes missed most, tried at least twice', () => {
    expect(missedFinishes(attempts)).toEqual([
      { target: 99, attempts: 2, finished: 0 },
      { target: 87, attempts: 2, finished: 1 },
    ]);
  });
});

describe('days and ranges', () => {
  const now = new Date(2026, 10, 5, 15, 0).getTime();

  it('covers the last n days including today', () => {
    const b = rangeBounds({ kind: 'days', days: 30 }, now);
    expect(b.from).toBe(new Date(2026, 9, 7).getTime());
    expect(b.to).toBe(addDays(now, 1) - 1);
    expect(rangeDays({ kind: 'days', days: 30 }, now)).toBe(30);
  });

  it('takes custom dates whole, in either order', () => {
    const r = {
      kind: 'custom' as const,
      from: new Date(2026, 10, 1, 9).getTime(),
      to: new Date(2026, 9, 12, 20).getTime(),
    };
    expect(rangeBounds(r, now).from).toBe(new Date(2026, 9, 12).getTime());
    expect(rangeDays(r, now)).toBe(21);
  });

  it('marks the kinds of session on each day', () => {
    const b = { from: addDays(now, -2), to: addDays(now, 1) - 1 };
    const list = days(
      [
        { at: now, kind: 'game' },
        { at: now - 3600_000, kind: 'drill' },
        { at: addDays(now, -2) + 1, kind: 'drill' },
        { at: addDays(now, -9), kind: 'game' },
      ],
      b,
    );
    expect(list.map((d) => d.kinds)).toEqual([['drill'], [], ['game', 'drill']]);
    expect(list[2]!.day).toBe(startOfDay(now));
  });

  it('counts streaks, not breaking for today unplayed', () => {
    expect(streaks([true, true, false, true, true, true, false])).toEqual({
      current: 3,
      longest: 3,
    });
    expect(streaks([true, false])).toEqual({ current: 1, longest: 1 });
    expect(streaks([])).toEqual({ current: 0, longest: 0 });
  });

  it('finds the longest run’s days', () => {
    const list = [false, true, true, false, true].map((active, i) => ({ day: i, active }));
    expect(longestRun(list)).toEqual({ from: 1, to: 2, length: 2 });
  });
});
