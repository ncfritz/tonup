import type { DartEvent } from '../darts';

import type { GameVisit } from './types';

/** Adds a dart to the visit in progress (or starts one) for single-game games. */
export function addDart(
  visits: readonly GameVisit[],
  player: number,
  dart: DartEvent,
  points: number,
): GameVisit[] {
  const last = visits[visits.length - 1];
  if (last && !last.done && last.player === player) {
    const darts = [...last.darts, dart];
    return [
      ...visits.slice(0, -1),
      { ...last, darts, total: last.total + points, done: darts.length === 3 },
    ];
  }
  return [
    ...visits,
    { player, darts: [dart], total: points, bust: false, done: false, leg: 0, endsLeg: false },
  ];
}

/** Ends the visit in progress early (a win, or a player knocked out). */
export function endVisit(visits: readonly GameVisit[]): GameVisit[] {
  const last = visits[visits.length - 1];
  if (!last || last.done) return [...visits];
  return [...visits.slice(0, -1), { ...last, done: true }];
}

export const visitDone = (visits: readonly GameVisit[]) => visits[visits.length - 1]?.done ?? true;

/** Darts thrown so far in the visit in progress. */
export function dartsInVisit(visits: readonly GameVisit[]): number {
  const last = visits[visits.length - 1];
  return last && !last.done ? last.darts.length : 0;
}

/** The next player still in, after `from`. */
export function nextPlayer(
  from: number,
  n: number,
  isIn: (p: number) => boolean = () => true,
): number {
  for (let i = 1; i <= n; i++) {
    const p = (from + i) % n;
    if (isIn(p)) return p;
  }
  return from;
}

export function checkPlayer(expectedId: string | undefined, dart: DartEvent) {
  if (expectedId !== dart.playerId) {
    throw new Error(`Expected a dart from ${expectedId}, got ${dart.playerId}`);
  }
}
