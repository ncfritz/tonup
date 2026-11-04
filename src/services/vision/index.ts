// The on-device keypoint detector (modules/dart-vision, ADR 0011). Without the native module
// (tests, or a build without it) detection reports no model, so the app marks darts by hand.
import DartVision, { type DetectResult, type VisionCapabilities } from '@modules/dart-vision';

export type { DetectResult, VisionCapabilities };

export async function visionCapabilities(): Promise<VisionCapabilities> {
  if (!DartVision) return { model: false, version: null };
  try {
    return await DartVision.getCapabilitiesAsync();
  } catch {
    return { model: false, version: null };
  }
}

/** After a new model lands in Documents/models: loads it in place of the old one. */
export async function reloadModel(): Promise<VisionCapabilities> {
  if (!DartVision) return { model: false, version: null };
  try {
    return await DartVision.reloadModelAsync();
  } catch {
    return { model: false, version: null };
  }
}

/** Reads a photo; `size` is used when the native side isn't there. */
export async function detect(
  uri: string,
  size: { width: number; height: number },
): Promise<DetectResult> {
  const none: DetectResult = { ...size, sharpness: 0, modelVersion: null, keypoints: {}, tips: [] };
  if (!DartVision) return none;
  return DartVision.detectAsync(uri);
}
