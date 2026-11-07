// Capture's settings and the session in progress, kept in Documents/capture-state.json so they
// survive a restart. (Capture has no database: visits live in the outbox as files.)
import { File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import type { DetectResult } from '@/services/vision';
import { THEME_IDS, type Mode, type ThemeId } from '@/theme/themes';

import type { Draft } from './outbox';
import type { LabelFile, Photo, SessionInfo, SessionPlan } from './visit';

export interface CaptureState {
  /** Lab's address, as typed ("my-mac.local:3100"); empty until set. */
  labUrl: string;
  /** Let an installed model place the board and tips first. */
  prefill: boolean;
  /** The session being shot, or null between sessions. */
  session: SessionInfo | null;
  /** Visits saved in the current session. */
  visits: number;
  /** Ton Up's themes, picked in Settings: Training, dark, until changed. */
  theme: ThemeId;
  appearance: 'system' | Mode;
  /** Reads since the last blind check (capture-lab.md › Model reads): every Nth visit is one. */
  readsSinceBlind: number;
  /** The current session's reads: confirmed as read, fixed, blind checks and how many agreed. */
  readTally: ReadTally;
  /** How the values step takes each dart's score: tapping a board, or the keypad. */
  valuesInput: 'board' | 'keypad';
}

export interface ReadTally {
  confirmed: number;
  fixed: number;
  blind: number;
  agreed: number;
}
export const NO_READS: ReadTally = { confirmed: 0, fixed: 0, blind: 0, agreed: 0 };

const DEFAULTS: CaptureState = {
  labUrl: '',
  prefill: true,
  session: null,
  visits: 0,
  theme: 'training',
  appearance: 'dark',
  valuesInput: 'keypad',
  readsSinceBlind: 0,
  readTally: NO_READS,
};

interface Actions {
  set(change: Partial<CaptureState>): void;
  startSession(session: SessionInfo): void;
  /** Lab's plan for the session, once it answers (if it's still the session being shot). */
  setPlan(sessionId: string, plan: SessionPlan): void;
  /** A visit saved after a read or a blind check. */
  countRead(r: { blind: boolean; confirmed: boolean; agreed: boolean }): void;
  endSession(): void;
  savedVisit(): void;
  /** Label later's Undo: the visit wasn't kept after all. */
  unsavedVisit(): void;
}

let persist: (s: CaptureState) => void = () => {};

export const useCapture = create<CaptureState & Actions>((set, get) => {
  const update = (change: Partial<CaptureState>) => {
    set(change);
    const { labUrl, prefill, session, visits, theme, appearance, valuesInput } = get();
    const { readsSinceBlind, readTally } = get();
    persist({
      labUrl,
      prefill,
      session,
      visits,
      theme,
      appearance,
      valuesInput,
      readsSinceBlind,
      readTally,
    });
  };
  return {
    ...DEFAULTS,
    set: update,
    startSession: (session) => update({ session, visits: 0, readTally: NO_READS }),
    setPlan: (sessionId, plan) => {
      const session = get().session;
      if (session?.id === sessionId) update({ session: { ...session, plan } });
    },
    countRead: ({ blind, confirmed, agreed }) => {
      const t = get().readTally;
      update({
        readsSinceBlind: blind ? 0 : get().readsSinceBlind + 1,
        readTally: blind
          ? { ...t, blind: t.blind + 1, agreed: t.agreed + (agreed ? 1 : 0) }
          : {
              ...t,
              confirmed: t.confirmed + (confirmed ? 1 : 0),
              fixed: t.fixed + (confirmed ? 0 : 1),
            },
      });
    },
    endSession: () => update({ session: null, visits: 0 }),
    savedVisit: () => update({ visits: get().visits + 1 }),
    unsavedVisit: () => update({ visits: Math.max(0, get().visits - 1) }),
  };
});

const stateFile = () => new File(Paths.document, 'capture-state.json');

/** Loads the saved state and starts writing changes back (called once by the layout). */
export function hydrateCapture() {
  try {
    const f = stateFile();
    if (f.exists) {
      const saved = JSON.parse(f.textSync()) as Partial<CaptureState>;
      // A theme this build doesn't have (renamed, say) falls back to the default.
      if (saved.theme && !THEME_IDS.includes(saved.theme)) delete saved.theme;
      if (saved.appearance && !['system', 'light', 'dark'].includes(saved.appearance)) {
        delete saved.appearance;
      }
      if (saved.valuesInput && !['board', 'keypad'].includes(saved.valuesInput)) {
        delete saved.valuesInput;
      }
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
  /** Set when adding the tips to a visit saved values only: its label as saved. */
  saved?: LabelFile;
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

/** The camera's "saved to label later" note, shown for a moment after Label later. */
export const useLaterNote = create<{
  /** The draft just saved, which the note's Undo takes back; null when there's no note. */
  draftId: string | null;
  setNote(draftId: string | null): void;
}>((set) => ({
  draftId: null,
  setNote: (draftId) => set({ draftId }),
}));
