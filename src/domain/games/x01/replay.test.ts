import { botThrow, seeded } from '../../bot';
import type { DartEvent, PlayerRef } from '../../darts';
import { fold } from '../fold';

import { x01, X01_DEFAULTS, x01Frames, x01Legs, type X01State } from '.';

const A: PlayerRef = { id: 'a', name: 'A', botLevel: 4 };
const B: PlayerRef = { id: 'b', name: 'B', botLevel: 2 };

/** A whole best-of-5 between two bots, as darts. */
function match(): { darts: DartEvent[]; state: X01State } {
  const settings = { ...X01_DEFAULTS, legs: 3 };
  let state = x01.init(settings, [A, B]);
  const darts: DartEvent[] = [];
  const rng = seeded(4);
  while (x01.currentPlayer(state)) {
    const p = x01.currentPlayer(state)!;
    const t = botThrow(x01, state, p.botLevel!, rng)!;
    const d: DartEvent = {
      id: `${darts.length}`,
      sessionId: 's',
      playerId: p.id,
      seq: darts.length,
      point: t.point,
      hit: t.hit,
      intended: t.intended,
      source: 'bot',
      precision: 'exact',
      corrected: false,
      at: darts.length,
    };
    darts.push(d);
    state = x01.applyDart(state, d);
  }
  return { darts, state };
}

describe('X01 replay frames', () => {
  const { darts, state } = match();
  const frames = x01Frames(state);

  it('has one frame per visit, holding every dart once in order', () => {
    expect(frames.flatMap((f) => f.darts)).toEqual(darts);
  });

  it('matches the live game at every visit', () => {
    // Refold up to the end of each visit: the frame's scores are the game's scores then,
    // except after a checkout, when the game has already moved to the next leg.
    let count = 0;
    for (const f of frames) {
      count += f.darts.length;
      const then = fold(x01, state.settings, state.players, darts, count);
      if (f.checkout) {
        expect(f.remaining[f.player]).toBe(0);
      } else {
        expect(f.remaining).toEqual(then.remaining);
      }
    }
  });

  it('groups frames by leg, ending each leg with a checkout', () => {
    const legs = x01Legs(state);
    expect(legs.length).toBeGreaterThanOrEqual(3);
    expect(legs.length).toBeLessThanOrEqual(5);
    for (const l of legs) expect(l.frames[l.frames.length - 1]!.checkout).toBe(true);
    expect(legs.map((l) => l.leg)).toEqual(legs.map((_, i) => i));
  });
});
