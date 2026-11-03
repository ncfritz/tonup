# 0011: Snap to score with our own keypoint model

- Status: Accepted
- Date: 2026-11-02
- Builds on: [0005](0005-input-and-camera-phasing.md), [0006](0006-dart-event-log.md), [0009](0009-pro-contents.md)

## Context

ADR 0005 puts handheld "snap to score" first among the camera releases. It needs a model that finds the board and the dart tips in one photo ([../../research/camera-scoring.md](../../research/camera-scoring.md)). The published baseline, DeepDarts, has an open dataset under CC BY 4.0 ([IEEE DataPort](https://ieee-dataport.org/node/4367)); its code states no licence. The easiest trainer, Ultralytics YOLO-pose, is AGPL-3.0, which a closed-source paid app can't use without a paid licence.

## Decision

1. **Keypoints:** a photo is read as six kinds of keypoint: the four DeepDarts calibration points (where the 5/20, 13/6, 17/3 and 8/11 wires meet the outside of the double ring), the bull, and dart tips. The calibration points and bull give a homography to the board face; each tip maps through it to millimetres and is scored by the same board geometry as every other input (`src/domain/camera`).
2. **Our own model, permissive licences only:** a small heatmap keypoint network (MobileNetV3 backbone, BSD; our own head and training code) trained in PyTorch on an Apple-silicon Mac, exported with coremltools (BSD) and bundled in the app. No model server, no AGPL code. DeepDarts images are used under CC BY 4.0 with attribution in the app's acknowledgements.
3. **Native module:** `modules/dart-vision` (Expo Modules API, Swift) runs the Core ML model through Vision and decodes the heatmaps; capture uses `expo-camera`.
4. **Works before the model exists:** without a bundled model, or when the model can't find the board, the result screen asks the player to tap the four calibration points and the darts on the photo. That scores the visit through the same homography, and every marked photo is a labelled training example.
5. **Correction is the product:** every detected dart shows on the photo and on the board with its confidence; the player drags a marker, adds a missed dart, or removes a false one, then confirms. Only confirmed darts become events, with source `camera` and their board position.
6. **Training data stays on the phone:** photos and their final labels are kept only if the player turns on "Keep photos to improve detection"; they're stored in the app's Documents folder, visible in the Files app for copying to the Mac, and never uploaded.

## Consequences

- The app gains a camera permission and a native module (iOS only); it still runs if the module isn't linked (camera input turns off).
- Snap to score ships in stages: manual marking first, then the model as its accuracy reaches the bar in the plan.
- Camera scoring stays Pro (ADR 0009).
