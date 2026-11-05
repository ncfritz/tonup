// Whether Lab is reachable, for every screen (the Lab pill): one check shared by the app,
// made when the address changes, when the app comes back to the front, every 30 seconds while
// it's open, and on demand (a tap on the pill, Home on focus).
import { create } from 'zustand';

import { checkLab, type LabHealth } from './lab';

export const RECHECK_MS = 30_000;

interface LabHealthState {
  /** The address the last answer is for; null before any check. */
  url: string | null;
  health: LabHealth | null;
  checking: boolean;
}

export const useLabHealth = create<LabHealthState>(() => ({
  url: null,
  health: null,
  checking: false,
}));

let asking: { url: string; reply: Promise<LabHealth> } | null = null;

/** Checks Lab at `url` (one check at a time per address) and shares the answer. */
export function recheckLab(url: string, check: typeof checkLab = checkLab): Promise<LabHealth> {
  if (asking?.url === url) return asking.reply;
  if (useLabHealth.getState().url !== url) useLabHealth.setState({ url, health: null });
  useLabHealth.setState({ checking: true });
  const reply = check(url).then((health) => {
    if (asking?.url === url) asking = null;
    // An answer for an address since changed is dropped.
    if (useLabHealth.getState().url === url) useLabHealth.setState({ health, checking: false });
    return health;
  });
  asking = { url, reply };
  return reply;
}

/** No address: nothing to check. */
export function forgetLab() {
  asking = null;
  useLabHealth.setState({ url: null, health: null, checking: false });
}
