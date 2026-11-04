import { NativeModule, requireOptionalNativeModule } from 'expo';

/** A keypoint in the photo, normalised (0–1, top-left origin), with the model's confidence. */
export interface NativeKeypoint {
  x: number;
  y: number;
  c: number;
}

export interface VisionCapabilities {
  /** A keypoint model is available (bundled, or dropped into Documents/models for testing). */
  model: boolean;
  /** The model's version from its metadata, if any. */
  version: string | null;
}

export interface DetectResult {
  /** The photo's size after orientation, in pixels. */
  width: number;
  height: number;
  /** Variance of the Laplacian on a small greyscale copy: higher is sharper. */
  sharpness: number;
  /** Null when no model ran. */
  modelVersion: string | null;
  /** The calibration points and bull found, by id (cal20, cal6, cal3, cal11, bull). */
  keypoints: Partial<Record<'cal20' | 'cal6' | 'cal3' | 'cal11' | 'bull', NativeKeypoint>>;
  tips: NativeKeypoint[];
}

declare class DartVisionModule extends NativeModule {
  getCapabilitiesAsync(): Promise<VisionCapabilities>;
  /** Loads the model again (after a new one was put in Documents/models). */
  reloadModelAsync(): Promise<VisionCapabilities>;
  /** Reads a photo (a file:// URI); without a model, returns only the size and sharpness. */
  detectAsync(uri: string): Promise<DetectResult>;
}

// Optional: null when the native side isn't linked (tests, or a build without the module).
export default requireOptionalNativeModule<DartVisionModule>('DartVision');
