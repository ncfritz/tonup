import { hitOf, label, miss, type DartEvent, type Hit, type PlayerRef } from '../../darts';
import { fold } from '../fold';

import { x01, X01_DEFAULTS, type X01Settings, type X01State } from './x01';

const A: PlayerRef = { id: 'a', name: 'Alice' };
const B: PlayerRef = { id: 'b', name: 'Bob' };

const T = (n: number) => hitOf(n, 3);
const D = (n: number) => hitOf(n, 2);
const S = (n: number) => hitOf(n, 1);
const BULL = hitOf(25, 2);
const M = miss();

/** Plays hits in order, each by whoever is up, and returns the state. */
function play(settings: Partial<X01Settings>, players: PlayerRef[], hits: Hit[]): X01State {
  let state = x01.init({ ...X01_DEFAULTS, ...settings }, players);
  hits.forEach((hit, seq) => {
    const p = x01.currentPlayer(state)!;
    state = x01.applyDart(state, dart(p.id, seq, hit));
  });
  return state;
}

const dart = (playerId: string, seq: number, hit: Hit): DartEvent => ({
  id: `d${seq}`,
  sessionId: 's',
  playerId,
  seq,
  point: null,
  hit,
  source: 'keypad',
  precision: 'segment',
  corrected: false,
  at: 0,
});

describe('X01 scoring', () => {
  it('counts each visit down and passes the throw', () => {
    const s = play({}, [A, B], [T(20), T(20), T(20), S(20), S(5), S(1)]);
    expect(s.remaining).toEqual([321, 475]);
    expect(s.current).toBe(0);
    expect(s.visits.map((v) => v.scored)).toEqual([180, 26]);
  });

  it('finishes a nine-darter on a double', () => {
    const s = play(
      { legs: 1 },
      [A],
      [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)],
    );
    expect(x01.result(s)).toEqual({ winnerId: 'a', score: { a: 1 } });
    expect(x01.currentPlayer(s)).toBeNull();
    expect(x01.view(s).status).toEqual({ kind: 'matchWon', playerId: 'a' });
  });

  describe('busts', () => {
    // 501 - 180 - 180 = 141 left for Alice; Bob scores nothing in between.
    const to141 = [T(20), T(20), T(20), M, M, M, T(20), T(20), T(20), M, M, M];

    it('busts below zero and restores the score from the start of the visit', () => {
      const s = play({}, [A, B], [...to141, T(20), T(20), T(20)]);
      expect(s.remaining[0]).toBe(141);
      expect(s.visits[s.visits.length - 1]).toMatchObject({ bust: true, scored: 0, done: true });
      expect(s.current).toBe(1);
      expect(x01.view(s).status).toEqual({ kind: 'bust' });
    });

    it('busts on 1 left and on zero without a double', () => {
      expect(play({}, [A, B], [...to141, T(20), T(20), S(20)]).remaining[0]).toBe(141);
      expect(play({}, [A, B], [...to141, T(20), T(20), T(7)]).remaining[0]).toBe(141);
    });

    it('ends the visit at the bust, so the next dart is the opponent’s', () => {
      const s = play({}, [A, B], [...to141, T(20), T(20), S(20), T(20)]);
      expect(s.remaining).toEqual([141, 441]);
    });

    it('allows any finish with straight out, and trebles with master out', () => {
      const straight = play({ out: 'straight', legs: 1 }, [A, B], [...to141, T(20), T(20), T(7)]);
      expect(straight.winner).toBe(0);
      const master = play({ out: 'master', legs: 1 }, [A, B], [...to141, T(20), T(20), T(7)]);
      expect(master.winner).toBe(0);
      const masterOne = play({ out: 'master' }, [A, B], [...to141, T(20), T(20), S(20)]);
      expect(masterOne.remaining[0]).toBe(141);
    });
  });

  describe('double in', () => {
    it('scores nothing until a double, then counts that double', () => {
      const s = play({ in: 'double' }, [A], [T(20), S(20), D(20)]);
      expect(s.remaining[0]).toBe(461);
      expect(s.opened[0]).toBe(true);
      expect(s.visits[0]!.scored).toBe(40);
    });

    it('master in also opens on a treble', () => {
      expect(play({ in: 'master' }, [A], [S(20), T(20), S(20)]).remaining[0]).toBe(421);
    });

    it('undoes the opening on a bust', () => {
      // 101 double in: Alice opens with D20, then T20 leaves 1, a bust. She's back on 101 and
      // not opened, and it's Bob's throw.
      const s = play({ startScore: 101, in: 'double' }, [A, B], [D(20), T(20)]);
      expect(s.remaining[0]).toBe(101);
      expect(s.opened[0]).toBe(false);
      expect(s.current).toBe(1);
      expect(x01.view(s).status).toEqual({ kind: 'bust' });
    });
  });

  describe('legs and sets', () => {
    const leg = [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(19), D(12)];

    it('alternates who throws first each leg', () => {
      // Leg 1: Alice starts and wins in 9 darts (Bob's 6 darts in between).
      const leg1 = [...leg.slice(0, 3), M, M, M, ...leg.slice(3, 6), M, M, M, ...leg.slice(6)];
      const s = play({ legs: 2 }, [A, B], leg1);
      expect(s.legs).toEqual([1, 0]);
      expect(s.remaining).toEqual([501, 501]);
      expect(s.current).toBe(1);
      expect(x01.view(s).status).toEqual({ kind: 'legWon', playerId: 'a' });
    });

    it('plays sets: first to the legs wins the set, first to the sets wins the match', () => {
      // A one-player match of 2 sets of 2 legs needs 4 legs.
      const s = play({ legs: 2, sets: 2 }, [A], [...leg, ...leg, ...leg]);
      expect(s.sets).toEqual([1]);
      expect(s.legs).toEqual([1]);
      expect(s.set).toBe(1);
      const done = play({ legs: 2, sets: 2 }, [A], [...leg, ...leg, ...leg, ...leg]);
      expect(x01.result(done)).toEqual({ winnerId: 'a', score: { a: 2 } });
      expect(() => x01.applyDart(done, dart('a', 99, T(20)))).toThrow('over');
    });
  });

  it('finishes on the bull, which counts as a double', () => {
    expect(play({ startScore: 50, legs: 1 }, [A], [BULL]).winner).toBe(0);
  });

  it('rejects a dart from the wrong player', () => {
    const s = x01.init(X01_DEFAULTS, [A, B]);
    expect(() => x01.applyDart(s, dart('b', 0, T(20)))).toThrow('Expected a dart from a');
  });

  it('suggests the checkout route and the next dart to aim at', () => {
    const s = play({}, [A], [T(20), T(20), T(20), T(20), T(20), T(20)]);
    expect(s.remaining[0]).toBe(141);
    const v = x01.view(s);
    expect(v.status.kind).toBe('checkout');
    if (v.status.kind === 'checkout')
      expect(v.status.route.map(label)).toEqual(['T20', 'T19', 'D12']);
    expect(label(x01.targetFor(s)!)).toBe('T20');
    // After T20, 81 left with two darts.
    const next = x01.applyDart(s, dart('a', 6, T(20)));
    expect(label(x01.targetFor(next)!)).toBe('T19');
    // Not opened in a double-in game: aim at D20.
    expect(label(x01.targetFor(x01.init({ ...X01_DEFAULTS, in: 'double' }, [A]))!)).toBe('D20');
  });

  it('refolds to the same state, so undo is dropping the last dart', () => {
    const hits = [T(20), S(20), S(1), T(19), T(19), S(7)];
    const live = play({}, [A, B], hits);
    const events = hits.map((h, i) => dart(i < 3 ? 'a' : 'b', i, h));
    expect(fold(x01, X01_DEFAULTS, [A, B], events)).toEqual(live);
    const undone = fold(x01, X01_DEFAULTS, [A, B], events.slice(0, -1));
    expect(undone.remaining).toEqual([420, 387]);
    expect(fold(x01, X01_DEFAULTS, [A, B], events, 3).remaining).toEqual([420, 501]);
  });
});
