import type { DartEvent } from '../darts';
import { x01, X01_DEFAULTS } from '../games/x01';

import { throwAt } from './bot';
import type { Rng } from './rng';

/** A dart count after which a leg is abandoned, so a hopeless bot can't loop forever. */
const MAX_DARTS = 300;

/**
 * Plays `legs` solo legs of 501 double out with scatter `sigma` and returns the 3-dart
 * average (points scored per dart × 3, busts scoring nothing). Used to calibrate BOT_LEVELS.
 */
export function simulateAverage(sigma: number, legs: number, rng: Rng): number {
  let points = 0;
  let darts = 0;
  const me = { id: 'bot', name: 'Bot' };
  for (let l = 0; l < legs; l++) {
    let state = x01.init({ ...X01_DEFAULTS, legs: 1 }, [me]);
    let seq = 0;
    while (state.winner === null && seq < MAX_DARTS) {
      const target = x01.targetFor(state)!;
      const { point, hit } = throwAt(target, sigma, rng);
      const event: DartEvent = {
        id: `${seq}`,
        sessionId: 'sim',
        playerId: me.id,
        seq,
        point,
        hit,
        intended: target,
        source: 'bot',
        precision: 'exact',
        corrected: false,
        at: 0,
      };
      state = x01.applyDart(state, event);
      seq++;
    }
    points += 501 - state.remaining[0]!;
    darts += seq;
  }
  return (points / darts) * 3;
}
