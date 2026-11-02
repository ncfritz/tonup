// X01 stats (docs/data/game-rules.md → X01 family): pure functions over a folded game.
import { checkoutRoute } from '../checkout';
import type { X01State } from '../games/x01';

export interface X01Stats {
  darts: number;
  points: number;
  /** Points per three darts; busts score nothing. */
  average: number;
  /** Average over the first three visits of each leg. */
  first9Average: number;
  /** Darts thrown with a one-dart finish on. */
  checkoutAttempts: number;
  checkouts: number;
  /** Checkouts per attempt, 0–1; null with no attempts. */
  checkoutRate: number | null;
  highestCheckout: number;
  /** Visits of 100–139, 140–179 and 180. */
  tons: number;
  ton40s: number;
  oneEighties: number;
  legsWon: number;
  /** Fewest darts in a leg won; null with none won. */
  bestLeg: number | null;
}

const per3 = (points: number, darts: number) => (darts ? (points / darts) * 3 : 0);

export function x01Stats(state: X01State, playerId: string): X01Stats {
  const p = state.players.findIndex((pl) => pl.id === playerId);
  const out = state.settings.out;
  const mine = state.visits.filter((v) => v.player === p);

  let darts = 0;
  let points = 0;
  let f9Darts = 0;
  let f9Points = 0;
  let attempts = 0;
  let checkouts = 0;
  let highest = 0;
  let tons = 0;
  let ton40s = 0;
  let oneEighties = 0;
  const visitsInLeg = new Map<number, number>();
  const dartsInLeg = new Map<number, number>();
  const wonLegs: number[] = [];

  for (const v of mine) {
    const scored = v.bust ? 0 : v.scored;
    darts += v.darts.length;
    points += scored;
    const n = (visitsInLeg.get(v.leg) ?? 0) + 1;
    visitsInLeg.set(v.leg, n);
    dartsInLeg.set(v.leg, (dartsInLeg.get(v.leg) ?? 0) + v.darts.length);
    if (n <= 3) {
      f9Darts += v.darts.length;
      f9Points += scored;
    }
    v.before.forEach((before, i) => {
      if (v.openedBefore[i] && checkoutRoute(before, 1, out)) attempts++;
    });
    if (v.checkout) {
      checkouts++;
      highest = Math.max(highest, v.scored);
      wonLegs.push(v.leg);
    }
    if (scored === 180) oneEighties++;
    else if (scored >= 140) ton40s++;
    else if (scored >= 100) tons++;
  }

  const legDarts = wonLegs.map((l) => dartsInLeg.get(l) ?? 0);
  return {
    darts,
    points,
    average: per3(points, darts),
    first9Average: per3(f9Points, f9Darts),
    checkoutAttempts: attempts,
    checkouts,
    checkoutRate: attempts ? checkouts / attempts : null,
    highestCheckout: highest,
    tons,
    ton40s,
    oneEighties,
    legsWon: wonLegs.length,
    bestLeg: legDarts.length ? Math.min(...legDarts) : null,
  };
}
