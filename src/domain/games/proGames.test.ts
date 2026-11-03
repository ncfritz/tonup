import { hitOf, miss, type PlayerRef } from '../darts';

import { baseball } from './baseball';
import { clock, CLOCK_DEFAULTS } from './clock';
import { countUpGame } from './countUp';
import { fives } from './fives';
import { football } from './football';
import { golf } from './golf';
import { gotcha } from './gotcha';
import { halveIt } from './halveIt';
import { hareHounds, numberAt } from './hareHounds';
import { killer, KILLER_DEFAULTS } from './killer';
import { scam, SCAM_TARGETS } from './scam';
import { playHits } from './testing';
import { ticTacToe } from './ticTacToe';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const C: PlayerRef = { id: 'c', name: 'C' };
const S = (n: number) => hitOf(n, 1);
const D = (n: number) => hitOf(n, 2);
const T = (n: number) => hitOf(n, 3);
const M = miss();
const OUTER = hitOf(25, 1);
const BULL = hitOf(25, 2);

describe('Gotcha', () => {
  it('counts up, sends a player you land on back to zero, and busts over the target', () => {
    // A 60, B 60 → A goes back to 0.
    const s = playHits(
      gotcha,
      { target: 301, doubleOut: false },
      [A, B],
      [T(20), M, M, T(20), M, M],
    );
    expect(s.scores).toEqual([0, 60]);
    expect(s.gotchas).toEqual([0, 1]);
    const bust = playHits(gotcha, { target: 50, doubleOut: false }, [A, B], [T(15), T(5)]);
    expect(bust.scores[0]).toBe(0);
    expect(bust.visits[0]).toMatchObject({ bust: true, done: true });
    expect(bust.current).toBe(1);
  });

  it('wins on the exact target, with a double when double out is on', () => {
    expect(playHits(gotcha, { target: 40, doubleOut: false }, [A, B], [S(20), S(20)]).winner).toBe(
      0,
    );
    const s = playHits(gotcha, { target: 40, doubleOut: true }, [A, B], [S(20), S(20)]);
    expect(s.winner).toBeNull();
    expect(playHits(gotcha, { target: 40, doubleOut: true }, [A, B], [D(20)]).winner).toBe(0);
  });
});

describe('Fifty-One by Fives', () => {
  it('banks only visits that divide by five, voids a visit with a dart off the board', () => {
    const s = playHits(
      fives,
      { target: 51 },
      [A],
      [S(20), S(5), S(10), S(20), S(1), S(1), S(20), S(20), M],
    );
    // 35 → 7; 22 → nothing; 40 with a miss → void.
    expect(s.scores).toEqual([7]);
  });

  it('wins on exactly the target and busts over it', () => {
    expect(playHits(fives, { target: 4 }, [A], [S(20), M, M]).scores).toEqual([0]);
    expect(playHits(fives, { target: 4 }, [A], [S(10), S(5), S(5)]).winner).toBe(0);
    expect(playHits(fives, { target: 3 }, [A], [S(10), S(5), S(5)]).scores).toEqual([0]);
  });
});

describe('Count Up (game)', () => {
  it('adds everything and the highest total wins', () => {
    const s = playHits(countUpGame, { visits: 1 }, [A, B], [T(20), M, M, S(1), M, M]);
    expect(countUpGame.result(s)?.winnerId).toBe('a');
  });
});

describe('Nine Lives', () => {
  it('takes a life for a blank visit and leaves the last player standing', () => {
    const settings = { ...CLOCK_DEFAULTS, lives: 1 };
    const s = playHits(clock, settings, [A, B], [S(1), M, M, M, M, M]);
    expect(s.lives).toEqual([1, 0]);
    expect(clock.result(s)?.winnerId).toBe('a');
  });

  it('skips a player who is out', () => {
    const s = playHits(clock, { ...CLOCK_DEFAULTS, lives: 1 }, [A, B, C], [S(1), M, M, M, M, M]);
    expect(s.lives).toEqual([1, 0, 1]);
    expect(s.current).toBe(2);
  });
});

describe('Halve-It and Bermuda Triangle', () => {
  it('adds hits on the target and halves the total, rounded up, for a blank visit', () => {
    // 20s: 40; 19s: blank → 20; any double: D16 → 52.
    const s = playHits(
      halveIt,
      { list: 'halveIt' },
      [A],
      [S(20), S(20), M, S(5), M, M, D(16), M, M],
    );
    expect(s.scores).toEqual([52]);
    expect(s.halvings).toEqual([1]);
  });

  it('uses the Bermuda Triangle run', () => {
    expect(halveIt.init({ list: 'bermuda' }, [A]).targets).toHaveLength(12);
  });
});

describe('Hare and Hounds', () => {
  it('moves each player on round the board and the hound wins by catching up', () => {
    const settings = { headStart: 1 };
    let s = hareHounds.init(settings, [A, B]);
    expect(numberAt(s, 0)).toBe(20);
    expect(numberAt(s, 1)).toBe(5);
    // The hare is on 20 and the hound one behind on 5: misses change nothing...
    s = playHits(hareHounds, settings, [A, B], [M, M, M, M, M, M]);
    expect(s.winner).toBeNull();
    // ...and a hit on 5 moves the hound onto 20, where the hare is: caught.
    s = playHits(hareHounds, settings, [A, B], [M, M, M, S(5)]);
    expect(hareHounds.result(s)?.winnerId).toBe('b');
  });

  it('lets the hare win by getting all the way round', () => {
    const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
    const hits = order.flatMap((n, i) => (i % 3 === 2 ? [S(n), M, M, M] : [S(n)]));
    const s = playHits(hareHounds, { headStart: 5 }, [A, B], hits.slice(0, hits.length));
    expect(hareHounds.result(s)?.winnerId).toBe('a');
  });
});

describe('Scam', () => {
  it('closes numbers for the stopper and scores open ones for the scorer, then swaps', () => {
    // B stops first: closes 20, 19, 18. A scores: 20 closed (nothing), T17 = 51.
    const s = playHits(scam, {}, [A, B], [S(20), S(19), S(18), S(20), T(17), M]);
    expect(s.scores).toEqual([51, 0]);
    expect(s.open.filter((o) => !o)).toHaveLength(3);
  });

  it('ends after both innings, higher score winning', () => {
    // Each inning: the stopper closes everything over 7 visits; the scorer throws misses.
    const close = SCAM_TARGETS.map((n) => (n === 25 ? OUTER : S(n)));
    const inning = (): ReturnType<typeof miss>[] => {
      const out = [];
      for (let i = 0; i < close.length; i += 3) {
        out.push(...close.slice(i, i + 3));
        if (i + 3 < close.length) out.push(M, M, M);
      }
      return out;
    };
    const s = playHits(scam, {}, [A, B], [...inning(), ...inning()]);
    expect(s.over).toBe(true);
    expect(scam.result(s)?.winnerId).toBeNull();
  });
});

describe('Baseball', () => {
  it('scores runs on the inning’s number, and settles a tie on the bull', () => {
    const settings = { innings: 1, bullseye: false };
    const s = playHits(baseball, settings, [A, B], [T(1), M, M, S(1), M, M]);
    expect(s.runs).toEqual([3, 1]);
    expect(baseball.result(s)?.winnerId).toBe('a');
    const tie = playHits(baseball, settings, [A, B], [S(1), M, M, S(1), M, M]);
    expect(tie.over).toBe(false);
    expect(baseball.targetFor(tie)).toEqual({ segment: 25, multiplier: 2 });
    const settled = playHits(
      baseball,
      settings,
      [A, B],
      [S(1), M, M, S(1), M, M, BULL, M, M, M, M, M],
    );
    expect(baseball.result(settled)?.winnerId).toBe('a');
  });

  it('Bullseye Baseball counts runs only after a bull in the inning', () => {
    const s = playHits(baseball, { innings: 9, bullseye: true }, [A], [T(1), OUTER, T(1)]);
    expect(s.runs).toEqual([3]);
  });
});

describe('Golf', () => {
  it('scores each hole by the best dart: treble 1, double 2, single 3, else 5', () => {
    const s = playHits(golf, { holes: 9 }, [A], [S(1), T(1), M, M, M, M]);
    expect(s.strokes).toEqual([1 + 5]);
    expect(s.hole).toBe(3);
  });

  it('lowest total wins', () => {
    const holes = Array.from({ length: 9 }, () => [M, M, M]).flat();
    const a = Array.from({ length: 9 }, (_, i) => [T(i + 1), M, M]);
    const hits = a.flatMap((v, i) => [...v, ...holes.slice(i * 3, i * 3 + 3)]);
    const s = playHits(golf, { holes: 9 }, [A, B], hits);
    expect(s.strokes).toEqual([9, 45]);
    expect(golf.result(s)?.winnerId).toBe('a');
  });
});

describe('Football', () => {
  it('needs the bull for the ball, scores doubles, and loses the ball on a blank visit', () => {
    const s = playHits(football, { goals: 2 }, [A, B], [OUTER, D(16), M, M, M, M, M, M, M]);
    expect(s.goals).toEqual([1, 0]);
    expect(s.ball).toBeNull();
    const won = playHits(football, { goals: 2 }, [A, B], [BULL, D(16), D(5)]);
    expect(football.result(won)?.winnerId).toBe('a');
  });
});

describe('Tic-Tac-Toe', () => {
  it('claims squares and wins three in a row', () => {
    // A takes 12, 20, 1 (the top row) over two visits; B misses in between.
    const s = playHits(ticTacToe, { ring: 'any' }, [A, B], [S(12), S(20), M, M, M, M, S(1)]);
    expect(ticTacToe.result(s)?.winnerId).toBe('a');
  });

  it('blocks a line and calls a full grid with no line a draw', () => {
    const s = playHits(ticTacToe, { ring: 'any' }, [A, B], [S(12), S(20), M, M, M, M]);
    expect(ticTacToe.targetFor(s)).toEqual({ segment: 1, multiplier: 1 });
    // A ends with 12, 1, 11, 3, 2 and B with 20, the bull, 6, 16: no line for either.
    const draw = playHits(
      ticTacToe,
      { ring: 'any' },
      [A, B],
      [S(12), S(1), S(11), S(20), OUTER, S(6), S(3), S(2), M, S(16)],
    );
    expect(draw.over).toBe(true);
    expect(ticTacToe.result(draw)?.winnerId).toBeNull();
  });
});

describe('Killer variants', () => {
  const numbers = [5, 12, 9];
  it('Killer Cricket: three marks on your own number, then marks take lives', () => {
    const s = playHits(
      killer,
      { ...KILLER_DEFAULTS, variant: 'cricket', numbers },
      [A, B, C],
      [T(5), D(12), M],
    );
    expect(s.killer[0]).toBe(true);
    expect(s.lives).toEqual([3, 1, 3]);
  });

  it('Blind Killer hides the numbers', () => {
    const s = killer.init({ ...KILLER_DEFAULTS, variant: 'blind', numbers }, [A, B, C]);
    expect(killer.view(s).rows.map((r) => r.note)).toEqual(['?', '?', '?']);
    expect(killer.view(s).status).toEqual({ kind: 'playing' });
  });
});
