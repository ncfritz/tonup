import { seeded } from '../../bot/rng';
import { hitOf, miss, type PlayerRef } from '../../darts';
import { playHits } from '../testing';

import { drawNumbers, killer, KILLER_DEFAULTS } from '.';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const C: PlayerRef = { id: 'c', name: 'C' };
const D = (n: number) => hitOf(n, 2);
const M = miss();
const settings = { ...KILLER_DEFAULTS, numbers: [5, 12, 9] };

describe('Killer', () => {
  it('draws distinct numbers', () => {
    const n = drawNumbers(6, seeded(1));
    expect(new Set(n).size).toBe(6);
    expect(n.every((x) => x >= 1 && x <= 20)).toBe(true);
  });

  it('needs its own double to become a Killer, and only Killers take lives', () => {
    // A hits B's double before qualifying (nothing), then qualifies on D5, then hits D12.
    const s = playHits(killer, settings, [A, B, C], [D(12), D(5), D(12)]);
    expect(s.killer).toEqual([true, false, false]);
    expect(s.lives).toEqual([3, 2, 3]);
    expect(killer.view(s).rows[0]!.note).toBe('5 K');
  });

  it('costs a Killer a life to hit their own double', () => {
    const s = playHits(killer, settings, [A, B, C], [D(5), D(5), M]);
    expect(s.lives[0]).toBe(2);
    const kind = playHits(
      killer,
      { ...settings, ownDouble: 'nothing' },
      [A, B, C],
      [D(5), D(5), M],
    );
    expect(kind.lives[0]).toBe(3);
  });

  it('skips players who are out and ends with one left', () => {
    // A qualifies and takes two of B's lives, B and C miss, then A takes B's last life.
    const hits = [D(5), D(12), D(12), M, M, M, M, M, M, D(12), M, M];
    const s = playHits(killer, settings, [A, B, C], hits);
    expect(s.lives[1]).toBe(0);
    expect(s.current).toBe(2); // B is skipped
    const done = playHits(
      killer,
      { ...settings, numbers: [5, 12], lives: 1 },
      [A, B],
      [D(5), D(12)],
    );
    expect(killer.result(done)?.winnerId).toBe('a');
  });

  it('aims at its double, then at whoever has fewest lives', () => {
    expect(killer.targetFor(killer.init(settings, [A, B, C]))).toEqual({
      segment: 5,
      multiplier: 2,
    });
    const s = playHits(killer, settings, [A, B, C], [D(5), D(9), M, M, M, M, M, M, M]);
    expect(killer.targetFor(s)).toEqual({ segment: 9, multiplier: 2 });
  });

  it('needs a number for everyone', () => {
    expect(() => killer.init({ ...settings, numbers: [5, 5, 9] }, [A, B, C])).toThrow();
    expect(() => killer.init(settings, [A])).toThrow();
  });
});
