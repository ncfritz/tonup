// Label files from the phone (capture-lab.md › Outbox and upload): Ton Up's "Keep photos"
// format (ADR 0011, src/features/camera/captures.ts) and Ton Up Capture's, which adds the
// session, the entered values and flags per dart. Both parse to one LabelInput.
import { CALIBRATION_IDS, type CalibrationId, type ImagePoint } from '@domain/camera';
import { z } from 'zod';

const point = z.object({ x: z.number().min(-0.5).max(1.5), y: z.number().min(-0.5).max(1.5) });

const dart = z.object({
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  /** Capture: what the player entered for this dart ("T20", "Miss", "Bounce-out"). */
  value: z.string().max(16).nullable().optional(),
  onWire: z.boolean().optional(),
});

export const captureFile = z.object({
  /** Capture sends its own ID; Ton Up's files are named by it. */
  id: z.string().min(1).max(64).optional(),
  image: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  createdAt: z.string().min(10),
  typeId: z.string().nullable().optional(),
  modelVersion: z.string().nullable().optional(),
  /** DeepDarts order: cal20, cal6, cal3, cal11, then the bull; null where not visible. */
  calibration: z.array(point.nullable()).max(5),
  darts: z.array(dart).max(6),
  missed: z.number().int().min(0).max(3).optional(),
  // Ton Up Capture only.
  sessionId: z.string().min(1).max(64).optional(),
  sessionStartedAt: z.string().optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
  valuesOnly: z.boolean().optional(),
  /** Sent with "Label later": the photo only, to label in Lab (its darts and points empty). */
  unlabelled: z.boolean().optional(),
  prefillModel: z.string().nullable().optional(),
  /** What the model placed before the player confirmed (same order and shape as the label). */
  prefill: z
    .object({
      calibration: z.array(point.nullable()).max(5),
      tips: z.array(point.nullable()).max(6),
    })
    .optional(),
  zoom: z.number().positive().optional(),
  deviceModel: z.string().max(80).optional(),
});
export type CaptureFile = z.infer<typeof captureFile>;

export interface LabelDart {
  entered: string | null;
  tip: ImagePoint | null;
  onWire: boolean;
}

export interface LabelInput {
  points: Partial<Record<CalibrationId, ImagePoint>>;
  darts: LabelDart[];
  missed: number;
}

export function labelFromFile(f: CaptureFile): LabelInput {
  const points: LabelInput['points'] = {};
  f.calibration.forEach((p, i) => {
    const id = CALIBRATION_IDS[i];
    if (p && id) points[id] = { x: p.x, y: p.y };
  });
  const darts = f.darts.map((d) => ({
    entered: d.value ?? null,
    tip:
      !f.valuesOnly && typeof d.x === 'number' && typeof d.y === 'number'
        ? { x: d.x, y: d.y }
        : null,
    onWire: d.onWire ?? false,
  }));
  return { points, darts, missed: f.missed ?? 0 };
}

/** Lab's own edits (the label editor) arrive in this shape. */
export const labelInput = z.object({
  points: z.partialRecord(z.enum(['cal20', 'cal6', 'cal3', 'cal11', 'bull']), point),
  darts: z
    .array(
      z.object({
        entered: z.string().max(16).nullable(),
        tip: point.nullable(),
        onWire: z.boolean(),
      }),
    )
    .max(6),
  missed: z.number().int().min(0).max(3),
});
