// Capture's settings and the session in progress, kept in Documents/capture-state.json so they
// survive a restart. (Capture has no database: visits live in the outbox as files.)
import { File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import type { DetectResult } from '@/services/vision';

import type { Draft } from './outbox';
import type { Photo, SessionInfo } from './visit';

export interface CaptureState {
  /** Lab's address, as typed ("my-mac.local:3100"); empty until set. */
  labUrl: string;
  /** Let an installed model place the board and tips first. */
  prefill: boolean;
  /** The session being shot, or null between sessions. */
  session: SessionInfo | null;
  /** Visits saved in the current session. */
  visits: number;
}

const DEFAULTS: CaptureState = { labUrl: '', prefill: true, session: null, visits: 0 };

interface Actions {
  set(change: Partial<CaptureState>): void;
  startSession(session: SessionInfo): void;
  endSession(): void;
  savedVisit(): void;
}

let persist: (s: CaptureState) => void = () => {};

export const useCapture = create<CaptureState & Actions>((set, get) => {
  const update = (change: Partial<CaptureState>) => {
    set(change);
    const { labUrl, prefill, session, visits } = get();
    persist({ labUrl, prefill, session, visits });
  };
  return {
    ...DEFAULTS,
    set: update,
    startSession: (session) => update({ session, visits: 0 }),
    endSession: () => update({ session: null, visits: 0 }),
    savedVisit: () => update({ visits: get().visits + 1 }),
  };
});

const stateFile = () => new File(Paths.document, 'capture-state.json');

/** Loads the saved state and starts writing changes back (called once by the layout). */
export function hydrateCapture() {
  try {
    const f = stateFile();
    if (f.exists) {
      const saved = JSON.parse(f.textSync()) as Partial<CaptureState>;
      useCapture.setState({ ...DEFAULTS, ...saved });
    }
  } catch {
    // A missing or broken file just means defaults.
  }
  persist = (s) => {
    try {
      const f = stateFile();
      f.create({ overwrite: true });
      f.writeSync(JSON.stringify(s));
    } catch {
      // Best effort; the next change tries again.
    }
  };
}

/** A new session's ID: readable and safe for Lab ("sess-20261103-2102-a1b2"). */
export function newSessionId(now: Date, random: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `sess-${stamp}-${random
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 4)
    .toLowerCase()}`;
}

/** The photo to label, handed to the labelling screen (not saved): just taken, or a draft. */
export interface Shot {
  photo: Photo;
  detected: DetectResult | null;
  /** Set when labelling a photo saved with "Label later": its session, ID and time. */
  draft?: Draft;
}

export const useShot = create<{
  shot: Shot | null;
  setShot(shot: Shot | null): void;
}>((set) => ({ shot: null, setShot: (shot) => set({ shot }) }));

/** Labelling saved drafts one after another: their IDs, where we are, and how it went. */
export interface LabelRun {
  ids: string[];
  index: number;
  labelled: number;
  valuesOnly: number;
  skipped: number;
}

export const useLabelRun = create<{
  run: LabelRun | null;
  setRun(run: LabelRun | null): void;
}>((set) => ({ run: null, setRun: (run) => set({ run }) }));

/** The camera's "saved to label later" note, shown once after Label later. */
export const useLaterNote = create<{ note: boolean; setNote(note: boolean): void }>((set) => ({
  note: false,
  setNote: (note) => set({ note }),
}));
