// Starting a drill from the Practice tab, a plan, or Try again: saved settings where a drill has
// them, and a fresh deal for drills that deal (Random Checkout, Pressure).
import { drillFor, type DrillId } from '@/domain/drills';

import { YOU_ID } from '../game/lineup';
import { startDrill } from '../game/session';

export function startPractice(
  id: DrillId,
  name: string,
  settings: unknown = drillFor(id).defaults,
  { deal = true, rng = Math.random }: { deal?: boolean; rng?: () => number } = {},
): string {
  const def = drillFor(id);
  // The checkout trainer hands over its own deck rather than a fresh deal.
  const play = deal && def.deal ? def.deal(settings, rng) : settings;
  return startDrill(id, play, { id: YOU_ID, name });
}
