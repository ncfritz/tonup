// What in a label needs a look, item by item (capture-lab.md › Review queue): the reasons a
// capture is in the review queue, pinned to the dart or board point each is about, so the label
// editor can mark them on the photo, in the darts table and among the board points.
import { CALIBRATION_IDS, MAX_RESIDUAL_MM, type CalibrationId } from '@domain/camera';

import type { Measured } from './conditions';
import type { LabelInput } from './labels';
import { KEYPOINT_LABELS } from './overlay';

export type NeedTone = 'error' | 'warning';

export interface Need {
  key: string;
  tone: NeedTone;
  text: string;
  /** What it's about, to select; none for the label as a whole. */
  target: { kind: 'dart'; idx: number } | { kind: 'point'; id: CalibrationId } | null;
}

export interface Needs {
  list: Need[];
  darts: Record<number, NeedTone>;
  points: Partial<Record<CalibrationId, NeedTone>>;
}

export function needsOf(
  label: LabelInput,
  m: Measured,
  corrected: boolean,
  /** Sent from Capture to label here, and not labelled yet. */
  unlabelled = false,
): Needs {
  const list: Need[] = [];
  const darts: Record<number, NeedTone> = {};
  const points: Partial<Record<CalibrationId, NeedTone>> = {};

  if (unlabelled) {
    list.push({
      key: 'unlabelled',
      tone: 'warning',
      text: 'Not labelled yet: place the board points, then add each dart (click its tip) and its value',
      target: { kind: 'point', id: CALIBRATION_IDS.find((id) => !label.points[id]) ?? 'cal20' },
    });
  }

  if (m.review.includes('board not marked')) {
    const missing = CALIBRATION_IDS.filter((id) => !label.points[id]);
    const short = missing.length - 1; // four of the five fit the board
    for (const id of missing) points[id] = 'warning';
    list.push({
      key: 'board',
      tone: 'warning',
      text: `Board points: place ${short === 1 ? 'one more' : `${short} more`} so the tips can be scored (${missing.map((id) => KEYPOINT_LABELS[id]).join(', ')} not placed)`,
      target: { kind: 'point', id: missing[0]! },
    });
  } else if (m.fit && m.fit.residual > MAX_RESIDUAL_MM) {
    const [worst, mm] = (Object.entries(m.fit.errors) as [CalibrationId, number][]).sort(
      (a, b) => b[1] - a[1],
    )[0]!;
    points[worst] = 'error';
    list.push({
      key: 'board',
      tone: 'error',
      text: `Board points don't agree: ${KEYPOINT_LABELS[worst]} is ${mm.toFixed(0)} mm out, the most of any. Check it first`,
      target: { kind: 'point', id: worst },
    });
  }

  m.darts.forEach((d, idx) => {
    const n = idx + 1;
    if (d.mismatch) {
      darts[idx] = 'error';
      list.push({
        key: `dart${idx}`,
        tone: 'error',
        text: `Dart ${n}: entered ${d.entered}, its tip scores ${d.scored}. Fix whichever is wrong`,
        target: { kind: 'dart', idx },
      });
    } else if (d.onWire) {
      darts[idx] = 'warning';
      list.push({
        key: `dart${idx}`,
        tone: 'warning',
        text: `Dart ${n} is on the wire: check ${d.entered ?? 'its value'} is the side it counted`,
        target: { kind: 'dart', idx },
      });
    }
  });

  if (corrected) {
    list.push({
      key: 'corrected',
      tone: 'warning',
      text: 'The model’s placement was corrected: check the label against the photo (the model’s is dashed)',
      target: null,
    });
  }
  return { list, darts, points };
}
