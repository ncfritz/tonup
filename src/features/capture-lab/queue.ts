// Labelling later (docs/plan/capture-lab.md › Label later): photos saved without labels wait
// in the drafts folder; labelling them runs through them one after another, each with the
// model's pre-fill read fresh (Capture may have a newer model by then).
import { router } from 'expo-router';

import { log } from '@/services/diagnostics';
import { detect, type DetectResult } from '@/services/vision';

import { fileDrafts } from './outboxFiles';
import { useCapture, useLabelRun, useShot } from './store';
import type { Photo } from './visit';

/** The model's reading of a photo, when pre-filling is on and a model is installed. */
export async function prefillFor(photo: Photo): Promise<DetectResult | null> {
  if (!useCapture.getState().prefill) return null;
  try {
    const d = await detect(photo.uri, photo);
    return d.modelVersion ? d : null;
  } catch (e) {
    log('warn', 'capture detection failed', { error: String(e) });
    return null;
  }
}

/** Hands the labelling screen the draft at the run's current place; false when there's none. */
async function loadCurrent(): Promise<boolean> {
  const run = useLabelRun.getState().run;
  const id = run?.ids[run.index];
  if (!id) return false;
  const draft = fileDrafts.list().find((d) => d.id === id);
  if (!draft) {
    // Labelled or gone since the run started: on to the next one.
    useLabelRun.getState().setRun({ ...run!, index: run!.index + 1 });
    return loadCurrent();
  }
  const photo = { uri: fileDrafts.photoUri(id), width: draft.width, height: draft.height };
  useShot.getState().setShot({ photo, detected: await prefillFor(photo), draft });
  return true;
}

/** Starts labelling these drafts, oldest first, opening the labelling screen on the first. */
export async function startLabelling(ids: string[], first?: string) {
  if (!ids.length) return;
  const index = first ? Math.max(0, ids.indexOf(first)) : 0;
  useLabelRun.getState().setRun({ ids, index, labelled: 0, valuesOnly: 0, skipped: 0 });
  if (await loadCurrent()) router.push('/label');
}

/**
 * The current draft is done (labelled, values only or skipped): on to the next one in place,
 * or back to where labelling started once they've all been seen.
 */
export async function nextDraft(outcome: 'labelled' | 'valuesOnly' | 'skipped') {
  const run = useLabelRun.getState().run;
  if (!run) return;
  useLabelRun.getState().setRun({ ...run, index: run.index + 1, [outcome]: run[outcome] + 1 });
  if (await loadCurrent()) return;
  stopLabelling();
}

/** Leaves the run; drafts not labelled stay as they are. */
export function stopLabelling() {
  useShot.getState().setShot(null);
  if (router.canGoBack()) router.back();
}
