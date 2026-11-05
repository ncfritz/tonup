import { hitOf, miss, type DartEvent, type Hit, type PlayerRef } from '../darts';
import { gameFor, type GameDefinition } from '../games';
import { FOOTBALL_DEFAULTS } from '../games/football';
import { KILLER_DEFAULTS } from '../games/killer';
import { TIC_TAC_TOE_DEFAULTS } from '../games/ticTacToe';
import { dartFor } from '../games/testing';

import { footballFigures, killerTally, scamInnings, ticTacToeFigures } from '.';

const A: PlayerRef = { id: 'a', name: 'A' };
const B: PlayerRef = { id: 'b', name: 'B' };
const D = (n: number) => hitOf(n, 2);
const S = (n: number) => hitOf(n, 1);
const M = miss();

function play(
  def: GameDefinition<unknown, unknown>,
  settings: unknown,
  ps: PlayerRef[],
  hits: Hit[],
) {
  let state = def.init(settings, ps);
  const darts: DartEvent[] = [];
  hits.forEach((hit, seq) => {
    const d = dartFor(def.currentPlayer(state)!.id, seq, hit);
    darts.push(d);
    state = def.applyDart(state, d);
  });
  return darts;
}

describe('Killer tally', () => {
  it('credits each life to whoever took it, and the last one as the knock-out', () => {
    const def = gameFor('killer');
    const settings = { ...KILLER_DEFAULTS, numbers: [1, 2] };
    // A becomes a Killer and takes two of B's lives; B misses; A takes the last.
    const darts = play(def, settings, [A, B], [D(1), D(2), D(2), M, M, M, D(2)]);
    const t = killerTally(def, settings, [A, B], darts);
    expect(t.taken).toEqual([
      [0, 3],
      [0, 0],
    ]);
    expect(t.out).toEqual([null, { by: 0, round: 2 }]);
  });
});

describe('Football figures', () => {
  it('counts darts to win the ball and darts per goal', () => {
    const darts = play(
      gameFor('football'),
      FOOTBALL_DEFAULTS,
      [A, B],
      [M, S(25), D(10), M, M, M, D(4)],
    );
    const f = footballFigures(FOOTBALL_DEFAULTS, [A, B], darts);
    expect(f.goals).toEqual([2, 0]);
    expect(f.dartsToWin[0]).toBe(2);
    expect(f.dartsPerGoal[0]).toBe(1);
    expect(f.dartsToWin[1]).toBeNull();
  });
});

describe('Tic-Tac-Toe figures', () => {
  it('lists the squares in the order they were won', () => {
    const darts = play(
      gameFor('ticTacToe'),
      TIC_TAC_TOE_DEFAULTS,
      [A, B],
      [S(20), M, M, S(25), M, M],
    );
    const f = ticTacToeFigures(TIC_TAC_TOE_DEFAULTS, [A, B], darts);
    expect(f.claims).toEqual([
      { cell: 1, target: 20, player: 0, order: 1 },
      { cell: 4, target: 25, player: 1, order: 2 },
    ]);
    expect(f.dartsPerSquare).toEqual([3, 3]);
  });
});

describe('Scam innings', () => {
  it('records which visit of the stopper closed each number, and what the scorer made', () => {
    // B stops first: 20, 19, 18 in visit 1; A scores 17 on its visit.
    const darts = play(gameFor('scam'), {}, [A, B], [S(20), S(19), S(18), S(17), M, M, S(17)]);
    const [first] = scamInnings([A, B], darts);
    expect(first!.stopper).toBe(1);
    expect(first!.closedOn.slice(0, 4)).toEqual([1, 1, 1, 2]);
    expect(first!.stoppedPerVisit).toEqual([3, 1]);
    expect(first!.points).toBe(17);
  });
});
