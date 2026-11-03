# Snap to score: implementation plan

- Status: In progress (2026-11-02): S1–S3 written; S2 and the training need a build and a run on the Mac
- Decisions: [ADR 0011](../architecture/decisions/0011-snap-to-score.md); background in [../research/camera-scoring.md](../research/camera-scoring.md)

After a visit the player takes one photo; the app finds the board and the darts, shows what it read, and the player confirms or fixes it. Built app side and model side together; the app works with manual marking until the model is good enough.

## Pieces

| Piece          | Where                                | What                                                                                                                                                                                               |
| -------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Geometry       | `src/domain/camera`                  | Keypoint ids, the calibration points' board positions, homography (DLT, least squares with the bull), image → board millimetres, proposals with confidence and a near-wire flag                    |
| Native module  | `modules/dart-vision`                | Swift: load `DartKeypoints.mlmodelc` if bundled, run it through Vision, decode heatmaps to keypoints, measure sharpness                                                                            |
| Capture        | `src/app/snap/[sessionId].tsx`       | `expo-camera` preview with a board guide, 1×/2× zoom, coaching ("Step a little to the side", "Snap, then pull")                                                                                    |
| Result         | same route                           | The photo with numbered markers, the board with the same darts, per-dart score and confidence; drag, add, remove; "One dart missed the board?" when fewer than expected; Confirm records the darts |
| Manual marking | same route                           | No model or no board found: tap the four calibration points (a diagram shows which), then the darts                                                                                                |
| Captures       | `captures` table, Documents/captures | With "Keep photos to improve detection" on: the photo and its final labels (DeepDarts format) for training                                                                                         |
| Training       | `ml/`                                | PyTorch model, loaders for DeepDarts and our captures, training on MPS, evaluation by score, Core ML export                                                                                        |

## Milestones

| #   | Delivers                                                                                                                   | Done when                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| S1  | Geometry, captures table, Camera input in games (Pro), capture and result screens with manual marking, keep-photos setting | A visit is scored from a photo by marking it, and the labels land in Documents/captures    |
| S2  | `dart-vision` module with heatmap decode, wired to the result screen                                                       | A bundled test model's keypoints appear on the photo                                       |
| S3  | `ml/` pipeline: DeepDarts loader, model, training, evaluation, export                                                      | A baseline trained on DeepDarts with its percent-correct-score on the DeepDarts test split |
| S4  | Fine-tune on our captures; evaluate per angle and distance                                                                 | Visit score correct on at least 90% of our own test photos                                 |
| S5  | Ship the model; burst capture keeping the sharpest; live view later                                                        | TestFlight with camera scoring on                                                          |

## Accuracy bar

Measured on our own held-out photos: dart segment correct ≥ 95%, visit total correct ≥ 90%, board found ≥ 98%. Below the bar the model still runs, but every visit opens on the result screen for checking (it always does in S1–S4).
