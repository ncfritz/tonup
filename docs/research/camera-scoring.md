# Camera scoring

Camera scoring comes after v1, in two steps (ADR 0005): first **snap to score**, a handheld photo after each visit, then a **fixed camera** on a stand that scores every dart as it lands. Both use the same detection model and training pipeline.

A single iPhone camera can score steel-tip darts well enough for play, but not at dedicated-hardware accuracy, so the product is built around fast, painless correction. The published baseline is [DeepDarts](https://arxiv.org/abs/2105.09880) (University of Waterloo, 2021): one network finds the dart tips and four board calibration points in a single image, scoring 94.7% of visits correctly from a face-on phone view and 84.0% from mixed angles. Its [code](https://github.com/wmcnally/deep-darts) and dataset are public. Dedicated three- and four-camera rigs such as Scolia reach about 99.8% because extra viewpoints resolve occlusion.

## How detection works

1. **Find the board:** detect the bull and the points where the segment wires meet the double and treble rings. With the board's known geometry, these give a homography that maps the image onto an ideal face-on board.
2. **Find the darts:** a keypoint model finds where each barrel enters the board, which is not where the flight appears in the image.
3. **Score:** map each tip through the homography to polar coordinates, then to ring and segment.
4. **Track the visit:** three darts, then the pull (the board is empty again) advances the turn. In snap mode the photo itself is the visit.

On iOS this needs AVFoundation for capture, Core ML for the model (converted with coremltools), Vision for request handling, and the Neural Engine for speed. In an Expo app that means a custom native module (Expo Modules API), as Tippytoe does for receipt scanning. Dartsmind requires an A12 chip or newer for the same reason.

## Step 1: snap to score (handheld)

After three darts, the player walks up and takes a photo; the app marks each dart and its score; the player confirms or drags a wrong marker, then pulls the darts.

Every photo calibrates itself: the board points found in that image give its angle, so no stand, setup or calibration rounds are needed. This is exactly the single-image approach DeepDarts measured.

**Two capture modes**

- **Photo (build first):** tap the shutter. A still is sharper than a video frame, and the app can take a short burst and keep the clearest frame.
- **Live view (add later):** the app overlays darts on the preview as it finds them and captures automatically once the image is steady and it's confident it has all three, like the document scanner in Notes.

**Problems and mitigations**

| Problem | Mitigation |
| --- | --- |
| Flights hide the tip from straight in front | Coach "step a little to the side" on the capture screen; the model can also infer the tip from the shaft's direction |
| Tight groups hide each other | Show confidence per dart; one-tap retake or fix |
| Bounce-outs and darts off the board aren't in the photo | If fewer than three are found, ask "One dart missed the board?" before scoring |
| Timing: the photo must come before the pull | The scoring screen prompts "Snap, then pull" until it's habit |
| Low light and blur | Burst and keep the sharpest; warn about glare instead of using the flash, which washes out the board |
| The board is small from the oche | Use the 2× or 3× lens; walking up is better |

Handheld photos come from many angles and distances, exactly the variety the dataset needs, so this step also builds the training data for the fixed camera.

## Step 2: fixed camera on a stand

We can't assume every player uses the same camera placement, so the app measures the camera's pose every session instead of assuming one. Each setup gets X (sideways offset from the bull), Y (height relative to the bull), Z (distance from the board face), plus tilt and rotation. The pose drives the placement guide, the accuracy estimate, and the angle labels on every training image.

**Measuring the pose:** the board homography plus the camera's intrinsics (AVFoundation delivers the intrinsic matrix per frame) decompose into the camera pose, so the app knows X/Y/Z without the user measuring anything. On LiDAR iPhones and iPads, depth can cross-check Z.

**Placement guide** (a starting hypothesis to validate with accuracy data per pose bin):

| Zone | Typical position | What to expect |
| --- | --- | --- |
| Recommended | Beside the board, 0.6–1.2 m out, 30–50° to the side, lens near bull height | Best view of tips entering the board; few occlusions |
| Acceptable | Low and in front (floor stand at the oche), or a high side mount | Works; tighter groups occlude more |
| Poor | Straight on from the throwing position, or nearly flat to the board | Darts hide each other or the tip is out of view |

The live view overlays the detected board outline and scores: whole board in frame, viewing angle, how many pixels the double ring spans, glare, and steadiness.

**Calibration rounds**

1. Board check: the app locks the outline and asks the player to confirm the 20 is at the top.
2. Rounds: three visits at named targets (for example T20, D16, bull) so darts land across the board.
3. Confirm: after each visit the player confirms or drags each detected dart.
4. Fit: the app measures the error per dart and fits a small per-setup correction (mostly a tip offset that depends on the viewing angle, because the camera sees the barrel, not the point).
5. Result: an accuracy estimate ("segment correct on 47 of 50 test darts") and advice if it's poor (move the stand, add light).
6. Save as a setup profile ("Garage board, left stand"). Next session the app re-detects the board and reuses the correction, so a bumped stand is caught without a full recalibration.

**Main risks:** occlusion in tight T20 groups (a second camera helps), wire-edge darts (show confidence and ask when a dart sits near a wire), lighting and glare (recommend a ring light; expose lighting as a setup check).

## Correction is a core feature

- Tap a dart, drag its marker to where it really landed, or pick the segment.
- Camera proposes, player confirms with a glance, so a wrong read never silently corrupts a game.
- Every dart keeps its board position, which feeds heatmaps, grouping and drift ("your T20 misses drift low-left"), which manual scorers can't produce.

## Training data pipeline

Start from the public DeepDarts data (about 15k mostly face-on phone images plus 830 multi-angle ones), then grow a dataset covering many camera poses, all on our own machines.

1. **Baseline:** train a keypoint model (dart tips plus board points) on DeepDarts and measure it on our own board before writing app code.
2. **Capture:** a debug build saves frames, detected darts, corrections and the camera pose for every dart. In release builds this is opt-in and stays on the device unless exported.
3. **Synthetic coverage:** render boards and darts in Blender across a grid of X/Y/Z positions, lighting and board brands. Labels are exact for free, and it fills angles real captures miss.
4. **Label:** corrections are already labels; review low-confidence ones in a self-hosted tool such as Label Studio or CVAT.
5. **Train:** PyTorch on a Mac (Apple-silicon GPU) or a CUDA box. A YOLO-pose-style model is a good first candidate, with the DeepDarts approach as the comparison.
6. **Evaluate:** accuracy per pose bin (angle and distance), lighting and board brand, so weak placements show up as numbers and feed the placement guide.
7. **Ship:** convert with coremltools, quantize, and bundle the model in app updates. No model server.

**Key metrics:** segment correct per dart, visit total correct, tip error in millimetres, and corrections needed per 100 darts.

## Open questions

- The DeepDarts repo states no licence; check the dataset's terms on IEEE Dataport before using it in a paid app.
- Minimum iPhone for camera scoring (competitors require A12 or newer); measure on the oldest device available.
- Soft-tip boards need their own data (hole texture, backlit segments); many electronic boards also report hits over Bluetooth, which may beat the camera (ADR 0003).
