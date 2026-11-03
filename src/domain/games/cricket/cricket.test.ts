import { hitOf, miss, type PlayerRef } from '../../darts';
import { playHits } from '../testing';

import { cricket, CRICKET_DEFAULTS } from '.';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const C: PlayerRef = { id: 'c', name: 'C' };
const T = (n: number) => hitOf(n, 3);
const S = (n: number) => hitOf(n, 1);
const M = miss();
const BULL = hitOf(25, 2);
const OUTER = hitOf(25, 1);
const std = { ...CRICKET_DEFAULTS, roundLimit: null };

describe('Cricket', () => {
  it('counts marks: single 1, double 2, treble 3, bulls 1 and 2; other numbers nothing', () => {
    const s = playHits(cricket, std, [A], [S(20), hitOf(19, 2), T(18), OUTER, BULL, S(5)]);
    expect(s.marks[0]).toEqual([1, 2, 3, 0, 0, 0, 3]);
    expect(s.visits.map((v) => v.total)).toEqual([6, 3]);
  });

  it('scores extra marks only while an opponent has the number open', () => {
    // A closes 20 and scores 2 extra marks (40); B closes 20; A's next 20s score nothing.
    const s = playHits(cricket, std, [A, B], [T(20), T(20), M, T(20), M, M, T(20)]);
    expect(s.points).toEqual([60, 0]);
    const detail = cricket.view(s).detail;
    expect(detail?.kind === 'cricket' && detail.dead[0]).toBe(true);
  });

  it('wins when everything is closed and points are level or ahead', () => {
    const close = [T(20), T(19), T(18), T(17), T(16), T(15), BULL, OUTER];
    // B throws misses in between.
    const hits = [...close.slice(0, 3), M, M, M, ...close.slice(3, 6), M, M, M, ...close.slice(6)];
    const s = playHits(cricket, std, [A, B], hits);
    expect(cricket.result(s)).toEqual({ winnerId: 'a', score: { a: 0, b: 0 } });
  });

  it('does not win while behind on points', () => {
    // B scores 60 on 20 first; A closes everything with 0 points: no win yet.
    const hits = [
      M,
      M,
      M,
      T(20),
      T(20),
      M,
      T(20),
      T(19),
      T(18),
      M,
      M,
      M,
      T(17),
      T(16),
      T(15),
      M,
      M,
      M,
      BULL,
      OUTER,
    ];
    const s = playHits(cricket, std, [A, B], hits);
    expect(s.points).toEqual([0, 60]);
    expect(s.winner).toBeNull();
  });

  it('Cut-Throat gives extra points to opponents with the number open, and lowest wins', () => {
    const s = playHits(
      cricket,
      { variant: 'cutThroat', roundLimit: null },
      [A, B, C],
      [T(20), T(20)],
    );
    expect(s.points).toEqual([0, 60, 60]);
  });

  it('ends at the round limit with the most points winning', () => {
    const s = playHits(
      cricket,
      { variant: 'standard', roundLimit: 1 },
      [A, B],
      [T(20), T(20), M, M, M, M],
    );
    expect(cricket.result(s)?.winnerId).toBe('a');
  });

  it('aims at the highest open number, or scores when behind', () => {
    const fresh = cricket.init(std, [A, B]);
    expect(cricket.targetFor(fresh)).toEqual({ segment: 20, multiplier: 3 });
    // A has 20 closed and is behind B: A should score on 20 if B still has it open.
    const s = playHits(cricket, std, [A, B], [T(20), M, M, T(19), T(19), M]);
    expect(s.points).toEqual([0, 57]);
    expect(cricket.targetFor(s)).toEqual({ segment: 20, multiplier: 3 });
  });

  it('reports marks per round', () => {
    const s = playHits(cricket, std, [A], [T(20), S(19), M]);
    expect(cricket.stats(s, 'a')).toEqual(
      expect.arrayContaining([{ key: 'mpr', value: 4, format: 'one' }]),
    );
  });
});

describe('Cricket variants', () => {
  it('No-Score: closing everything wins, with no points', () => {
    const close = [T(20), T(19), T(18), T(17), T(16), T(15), BULL, OUTER];
    const s = playHits(cricket, { variant: 'noScore', roundLimit: null }, [A], close);
    expect(s.points).toEqual([0]);
    expect(s.winner).toBe(0);
  });

  it('Tactics plays 10–20 and the bull', () => {
    const s = cricket.init({ variant: 'tactics', roundLimit: null }, [A]);
    expect(s.targets).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 25]);
    expect(
      playHits(cricket, { variant: 'tactics', roundLimit: null }, [A], [T(10)]).marks[0]![10],
    ).toBe(3);
  });

  it('Random plays the six numbers drawn, highest first, plus the bull', () => {
    const s = cricket.init({ variant: 'random', roundLimit: null, numbers: [3, 17, 9, 1, 12, 6] }, [
      A,
    ]);
    expect(s.targets).toEqual([17, 12, 9, 6, 3, 1, 25]);
    expect(() =>
      cricket.init({ variant: 'random', roundLimit: null, numbers: [1, 1, 2, 3, 4, 5] }, [A]),
    ).toThrow();
  });

  it('Mickey Mouse counts doubles and trebles off the board toward any double and any treble', () => {
    const settings = { variant: 'mickeyMouse' as const, roundLimit: null };
    // D5 and T7 aren't targets: they mark "any double" and "any treble".
    const s = playHits(cricket, settings, [A], [hitOf(5, 2), hitOf(7, 3), T(12)]);
    const t = s.targets;
    expect(s.marks[0]![t.indexOf(-2)]).toBe(1);
    expect(s.marks[0]![t.indexOf(-3)]).toBe(1);
    expect(s.marks[0]![t.indexOf(12)]).toBe(3);
  });
});
