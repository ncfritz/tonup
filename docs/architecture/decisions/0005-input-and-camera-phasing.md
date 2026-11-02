# 0005: v1 input is tap-on-board and keypad; the camera follows in two steps

- Status: Accepted
- Date: 2026-11-02

## Context

Camera scoring is the headline feature of competitors but needs a trained model, a native module, calibration and device linking, and single-camera accuracy (84–95% of visits in DeepDarts) means correction has to be excellent. Gameplay, practice and rules can ship and be useful without it.

## Decision

1. **v1:** scoring by tapping where each dart landed on a drawn board, or with a keypad (single/double/treble plus number). Tap input stores an approximate board position for every dart; keypad darts are placed at the segment's centre with a low-precision flag.
2. **Camera lite (next):** snap to score, a handheld photo after each visit, then live-view auto-capture; a third input option beside Board and Keypad. Each photo calibrates itself from board keypoints.
3. **Fixed camera (after):** a phone on a stand scoring each dart as it lands, with a placement guide, calibration rounds and setup profiles, plus an optional linked display (ADR 0008).

All three input methods produce the same dart events (ADR 0006), so stats, heatmaps and replay don't care where a dart came from. The training-data baseline (DeepDarts plus our own captures) can start in parallel with v1.

## Consequences

- v1 has no camera permission, no ML model and no native camera module.
- The tap-on-board board view is a core, reusable component (scoring, drills, replay, heatmaps, correction).
- The parked camera and linking mockups stay on the design canvas's MVP flow page.
