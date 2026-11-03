import { botThrow, seeded } from '../bot';
import { BULL, hitOf, miss, type Hit, type PlayerRef } from '../darts';
import { dartFor, playHits } from '../games/testing';

import { ASSESS_DOUBLES, assessmentLevels, levelFor } from './assessment';
import { finishable, ONE_TWENTY_ONE_TRIES, RANDOM_CHECKOUTS } from './checkouts';
import { JDC_PARTS } from './jdc';
import { ASSESSMENT_EVERY_MS, doubleRates, planFor, POOLS } from './plan';
import { explainRoute, trainerDeck, trainerRoute } from './routes';
import type { DrillDefinition } from './types';

import { drills } from '.';

const ME: PlayerRef = { id: 'you', name: 'You' };
const S = (n: number) => hitOf(n, 1);
const D = (n: number) => hitOf(n, 2);
const T = (n: number) => hitOf(n, 3);
const M = miss();
const times = (n: number, h: Hit) => Array.from({ length: n }, () => h);

describe('100 darts at T20', () => {
  it('counts trebles over exactly 100 darts', () => {
    const s = playHits(
      drills.t20,
      drills.t20.defaults,
      [ME],
      [...times(30, T(20)), ...times(70, S(20))],
    );
    expect(s.over).toBe(true);
    expect(drills.t20.score(s)).toBe(30);
    expect(s.visits[s.visits.length - 1]!.darts).toHaveLength(1);
    expect(drills.t20.stats(s, 'you')).toEqual(
      expect.arrayContaining([{ key: 'hitRate', value: 0.3, format: 'pct' }]),
    );
    expect(drills.t20.steps(s)[0]).toMatchObject({ label: '10', state: 'done', value: 10 });
  });
});

describe('Bullseye', () => {
  it('counts either bull over 30 darts', () => {
    const s = playHits(
      drills.bullseye,
      drills.bullseye.defaults,
      [ME],
      [hitOf(BULL, 2), hitOf(BULL, 1), ...times(28, M)],
    );
    expect(s.over).toBe(true);
    expect(drills.bullseye.score(s)).toBe(2);
  });
});

describe('Checkouts Practice', () => {
  it('scores the value of each double hit', () => {
    const s = playHits(drills.checkouts, {}, [ME], [D(20), M, D(20), M, M, D(18)]);
    expect(drills.checkouts.score(s)).toBe(40 + 40 + 36);
    expect(drills.checkouts.targetFor(s)).toEqual({ segment: 16, multiplier: 2 });
  });
});

describe('Doubles Lock', () => {
  it('moves down on a hit and falls back to the last lock on a blank visit', () => {
    // D20 to D12 in three visits passes the D15 lock; then a blank visit.
    const hits = [...Array.from({ length: 9 }, (_, i) => D(20 - i)), M, M, M];
    const s = playHits(drills.doublesLock, {}, [ME], hits);
    expect(drills.doublesLock.targetFor(s)).toEqual({ segment: 15, multiplier: 2 });
    expect(s.falls).toBe(1);
  });

  it('finishes on D1, scored by darts', () => {
    const all = Array.from({ length: 20 }, (_, i) => D(20 - i));
    const s = playHits(drills.doublesLock, {}, [ME], all);
    expect(drills.doublesLock.result(s)).toEqual({ winnerId: 'you', score: { you: 20 } });
  });
});

describe('170 Practice', () => {
  it('needs T20, T20 and the bull in order', () => {
    const s = playHits(
      drills.oneSeventy,
      {},
      [ME],
      [T(20), M, hitOf(BULL, 2), T(20), hitOf(BULL, 2)],
    );
    expect(drills.oneSeventy.result(s)).toEqual({ winnerId: 'you', score: { you: 5 } });
  });
});

describe('checkout drills', () => {
  it('Catch 40 scores 3, 2 or 1 by darts used, and busts go back to the visit start', () => {
    const { catch40 } = drills;
    // 61: T15 D8 (two darts, 3 points). 62: T10 D16 in two (3). 63: bust then finish later.
    let s = playHits(catch40, {}, [ME], [T(15), D(8)]);
    expect(s.attempts[0]).toEqual({ target: 61, finished: true, darts: 2 });
    expect(s.remaining).toBe(62);
    s = playHits(catch40, {}, [ME], [T(15), D(8), T(20), S(2)]);
    // 62 - 60 = 2, then a single 2 leaves 0 without a double: bust, back to 62.
    expect(s.remaining).toBe(62);
    expect(s.visits[s.visits.length - 1]!.bust).toBe(true);
    s = playHits(catch40, {}, [ME], [T(15), D(8), T(20), S(2), T(10), D(16)]);
    expect(s.attempts[1]).toEqual({ target: 62, finished: true, darts: 4 });
    expect(catch40.score(s)).toBe(4);
  });

  it('121 climbs after a finish and scores the highest', () => {
    const { oneTwentyOne } = drills;
    // 121: T20 S11 D25? use T20, T17, D5 = 60 + 51 + 10 = 121.
    const s = playHits(oneTwentyOne, {}, [ME], [T(20), T(17), D(5)]);
    expect(s.remaining).toBe(122);
    expect(oneTwentyOne.score(s)).toBe(121);
    const blanks = playHits(oneTwentyOne, {}, [ME], times(9 * ONE_TWENTY_ONE_TRIES, M));
    expect(oneTwentyOne.result(blanks)).toEqual({ winnerId: 'you', score: { you: 0 } });
  });

  it('Random Checkout deals twenty finishable targets', () => {
    const { randomCheckout } = drills;
    const settings = randomCheckout.deal!({}, seeded(4));
    expect(settings.targets).toHaveLength(RANDOM_CHECKOUTS);
    const ok = new Set(finishable(40, 170));
    for (const t of settings.targets!) expect(ok.has(t)).toBe(true);
    const s = randomCheckout.init(settings, [ME]);
    expect(randomCheckout.prompt!(s)).toEqual({
      kind: 'finish',
      remaining: settings.targets![0],
      dartsLeft: 3,
    });
  });

  it('Pressure gives one visit per leg and says what the bot is on', () => {
    const { pressure } = drills;
    const s = playHits(pressure, { targets: [40, 50], botOn: [32, 16] }, [ME], [M, M, M]);
    expect(s.attempts[0]).toEqual({ target: 40, finished: false, darts: 3 });
    expect(pressure.prompt!(s)).toEqual({
      kind: 'pressure',
      remaining: 50,
      dartsLeft: 3,
      botOn: 16,
    });
    expect(pressure.targetFor(s)).toEqual({ segment: BULL, multiplier: 2 });
  });
});

describe('Halve-It Sprint and Shanghai', () => {
  it('halves on a blank visit', () => {
    const { halveIt } = drills;
    const s = playHits(halveIt, halveIt.defaults, [ME], [T(20), S(20), M, M, M, M]);
    expect(halveIt.score(s)).toBe(40);
    expect(
      halveIt
        .steps(s)
        .map((x) => x.state)
        .slice(0, 3),
    ).toEqual(['done', 'missed', 'current']);
  });

  it('plays 1 to 20 without ending on a Shanghai', () => {
    const { shanghai } = drills;
    const s = playHits(shanghai, shanghai.defaults, [ME], [S(1), D(1), T(1)]);
    expect(s.over).toBe(false);
    expect(shanghai.score(s)).toBe(6);
    expect(shanghai.stats(s, 'you')).toEqual(
      expect.arrayContaining([{ key: 'shanghais', value: 1, format: 'int' }]),
    );
  });
});

describe('JDC Challenge', () => {
  it('scores Shanghai rounds with a bonus and 50 for each double', () => {
    const { jdc } = drills;
    // 10: S, D, T = 60 + 100 bonus. 11–15 blank. Then D1 hit.
    const s = playHits(jdc, {}, [ME], [S(10), D(10), T(10), ...times(15, M), D(1)]);
    expect(jdc.score(s)).toBe(160 + 50);
    expect(JDC_PARTS).toHaveLength(33);
  });
});

describe('skill assessment', () => {
  it('levels each skill and scores their sum', () => {
    const { assessment } = drills;
    // Scoring: ten visits of 60 (average 60 → level 4).
    const scoring = Array.from({ length: 10 }).flatMap(() => [S(20), S(20), S(20)]);
    // Doubles: one hit in three at each (33% → level 4).
    const doubles = ASSESS_DOUBLES.flatMap((n) => [D(n), M, M]);
    // Checkouts: 32 (D16), then five blank visits.
    const checkouts = [D(16), ...times(15, M)];
    const s = playHits(assessment, {}, [ME], [...scoring, ...doubles, ...checkouts]);
    expect(s.over).toBe(true);
    expect(assessmentLevels(s)).toEqual({ scoring: 4, doubles: 4, checkouts: 2 });
    expect(assessment.score(s)).toBe(10);
    expect(levelFor('scoring', 29)).toBe(1);
    expect(levelFor('scoring', 80)).toBe(5);
  });
});

describe.each(Object.keys(drills) as (keyof typeof drills)[])('%s with a bot', (id) => {
  it('plays to a result', () => {
    const def = drills[id] as unknown as DrillDefinition<unknown, unknown>;
    const rng = seeded(id.length);
    const settings = def.deal ? def.deal(def.defaults, rng) : def.defaults;
    const bot: PlayerRef = { id: 'you', name: 'You', botLevel: 4 };
    let state = def.init(settings, [bot]);
    let seq = 0;
    while (def.currentPlayer(state) && seq < 5000) {
      const t = botThrow(def as never, state, 4, rng)!;
      state = def.applyDart(state, dartFor('you', seq++, t.hit));
    }
    expect(def.result(state)).not.toBeNull();
    expect(def.steps(state).length).toBeGreaterThan(0);
    expect(def.stats(state, 'you').length).toBeGreaterThan(0);
  });
});

describe('the adaptive plan', () => {
  const now = 100 * 24 * 60 * 60 * 1000;
  const intendedAt = (segment: number, hit: Hit) => ({
    ...dartFor('you', 0, hit),
    intended: { segment, multiplier: 2 as const },
  });

  it('asks for the assessment first', () => {
    expect(planFor({ levels: null, assessedAt: null, now, rates: [] })).toMatchObject({
      due: 'first',
      main: [],
    });
  });

  it('picks drills from the weakest area and names the doubles you miss', () => {
    const darts = [
      ...times(10, M).map(() => intendedAt(16, M)),
      intendedAt(16, D(16)),
      ...times(8, M).map(() => intendedAt(20, M)),
      intendedAt(20, D(20)),
      intendedAt(20, D(20)),
      intendedAt(8, D(8)),
    ];
    const rates = doubleRates(darts);
    const plan = planFor({
      levels: { scoring: 3, doubles: 2, checkouts: 3 },
      assessedAt: now - 1000,
      now,
      rates,
    });
    expect(plan.due).toBeNull();
    expect(plan.focus).toBe('doubles');
    for (const id of plan.main) expect(POOLS.doubles).toContain(id);
    expect(plan.doubles.map((d) => d.segment)).toEqual([16, 20]);
  });

  it('asks again after a month, and breaks ties toward doubles', () => {
    const plan = planFor({
      levels: { scoring: 2, doubles: 2, checkouts: 2 },
      assessedAt: now - ASSESSMENT_EVERY_MS - 1,
      now,
      rates: [],
    });
    expect(plan.due).toBe('monthly');
    expect(plan.focus).toBe('doubles');
  });

  it('takes the plan from an assessment that found checkouts weakest', () => {
    const plan = planFor({
      levels: { scoring: 4, doubles: 4, checkouts: 1 },
      assessedAt: now,
      now,
      rates: [],
    });
    expect(plan.focus).toBe('checkouts');
    for (const id of plan.main) expect(POOLS.checkouts.slice(0, 3)).toContain(id);
  });
});

describe('the checkout trainer', () => {
  it('explains a route: what the first dart leaves, a missed treble and a split double', () => {
    expect(
      explainRoute(100, [
        { segment: 20, multiplier: 3 },
        { segment: 20, multiplier: 2 },
      ]),
    ).toEqual([
      { kind: 'leaves', dart: 'T20', left: 40, finish: 'double', darts: 1 },
      { kind: 'single', single: '20', left: 80, ok: false },
      { kind: 'split', double: 'D20', single: '20', next: 'D10' },
    ]);
    expect(explainRoute(50, [{ segment: BULL, multiplier: 2 }])).toEqual([{ kind: 'bull' }]);
  });

  it('deals a deck of finishable scores in range', () => {
    const deck = trainerDeck('high', seeded(2));
    expect(deck).toHaveLength(10);
    for (const n of deck) {
      expect(n).toBeGreaterThanOrEqual(101);
      expect(trainerRoute(n)).not.toBeNull();
    }
  });
});
