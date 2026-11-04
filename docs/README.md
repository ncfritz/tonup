# Ton Up docs

Ton Up is an iOS darts app built on three pillars: scoring games (solo, against a bot, or with friends), practice and training, and knowledge (rules and checkouts). Camera scoring comes in later releases. It is built with Expo and stores everything on the device.

These docs start high level and get more specific as decisions are made. Each decision gets a short record in `architecture/decisions/`.

## Contents

| Doc                                                      | What it covers                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [features.md](features.md)                               | What the app does: v1 scope, Pro, later releases and ideas                            |
| [plan/v1-implementation.md](plan/v1-implementation.md)   | v1 stack, code layout, domain design, milestones, testing and risks                   |
| [plan/snap-to-score.md](plan/snap-to-score.md)           | Snap to score: geometry, native module, screens, training pipeline, milestones        |
| [plan/capture-lab.md](plan/capture-lab.md)               | Capture app and Lab web app for labelling, training runs, verification and models     |
| [research/competitors.md](research/competitors.md)       | Existing apps and hardware, pricing, gaps to exploit                                  |
| [research/camera-scoring.md](research/camera-scoring.md) | Handheld snap-to-score, the fixed camera, calibration, and the training-data pipeline |
| [research/multi-device.md](research/multi-device.md)     | Camera and display roles, linking options, joining by QR code                         |
| [research/training.md](research/training.md)             | Practice drills, benchmarks and the coaching ideas built on them                      |
| [research/naming.md](research/naming.md)                 | How the name Ton Up and tonup.app were chosen                                         |
| [data/game-rules.md](data/game-rules.md)                 | Rules for 26 games in five families, with variants and the stats each needs           |
| [architecture/data-model.md](architecture/data-model.md) | The dart event log and what is derived from it                                        |
| [architecture/decisions/](architecture/decisions/)       | Architecture decision records (ADRs)                                                  |
| [design/README.md](design/README.md)                     | Design principles and index of the design docs                                        |
| [design/themes.md](design/themes.md)                     | The five themes, light and dark, and their tokens                                     |
| [design/screens.md](design/screens.md)                   | Navigation and screen-by-screen notes for v1                                          |
| [design/mockups/](design/mockups/README.md)              | Reference copy of the design canvas source                                            |
| [release/app-store.md](release/app-store.md)             | App Store listing, in-app purchase and screenshots                                    |
| [release/privacy.md](release/privacy.md)                 | Privacy label, privacy manifest, policy text and what a problem report holds          |
| [release/testflight.md](release/testflight.md)           | Building, uploading and testing a TestFlight build, and the accessibility pass        |

## Research and mockups

- The original research doc, with the Game Rules and MVP Spec tabs: https://claude.ai/artifact/2LHg3DyYHxfsxmuzyaLYx5 (private to Neil). These docs supersede it where they differ.
- The interactive mockups live on a Claude design canvas, "Ton Up — App Design": https://claude.ai/artifact/BXFJmguteYy285CbJ5vzFf (private to Neil). Pages: Themes, MVP flow (includes the parked camera screens), Home navigation, and v1 screens (no camera). A reference copy of their source is in [design/mockups/](design/mockups/README.md).

## Conventions

- Decisions: add an ADR (`NNNN-short-title.md`) with Status, Date, Context, Decision and Consequences. Don't edit an accepted ADR's decision; supersede it with a new one.
- Open questions go at the bottom of the relevant doc under "Open questions" until they're decided.
- Facts taken from the web carry a link to their source.
