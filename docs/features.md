# Features

Status key: **v1** = planned for the first release · **Pro** = v1, behind the one-time Ton Up Pro upgrade (ADR 0009) · **Pro, later** = part of Pro, shipping in an update after v1 · **Later** = agreed direction, not scheduled · **Idea** = worth exploring.

The app is a $9.99 paid download; Ton Up Pro is a one-time $19.99 upgrade. Pro unlocks the other games, practice modes and themes, the analysis features, and camera scoring when it ships.

The bet: the best darts coach on iPhone, built on per-dart positions, offline-first, with a one-time price. Camera scoring is the input that will make coaching effortless, not the headline (see [research/competitors.md](research/competitors.md)).

## Scoring games

| Feature                                                                                                                                                                 | Status | Notes                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| X01 (301, 501, 701, 1001)                                                                                                                                               | v1     | Straight-in or double-in; double-out, master-out or single-out; legs and sets; bust rules |
| Cricket: Standard and Cut-Throat                                                                                                                                        | v1     | Marks per round, scoring on closed numbers                                                |
| Around the Clock                                                                                                                                                        | v1     | Variants: doubles only, trebles only, skip ahead on D/T, reverse                          |
| Shanghai                                                                                                                                                                | v1     | 7 or 20 rounds; instant win on a Shanghai (optional)                                      |
| Killer                                                                                                                                                                  | v1     | Lives 3–6; qualify on own double; variants as toggles                                     |
| Other cricket variants (No-Score, Tactics, Random, Mickey Mouse)                                                                                                        | Pro    | As they ship                                                                              |
| Party and sports games (Halve-It, Bermuda Triangle, Gotcha, Fifty-One by Fives, Nine Lives, Hare and Hounds, Baseball, Golf, Football, Tic-Tac-Toe, Blind Killer, Scam) | Pro    | Content updates on the same engine; rules in [data/game-rules.md](data/game-rules.md)     |
| Pass-and-play, up to 6 players on one device                                                                                                                            | v1     | Players and bots mixed                                                                    |
| Bot opponent, 5 levels                                                                                                                                                  | v1     | Gaussian scatter model tuned to target averages (ADR 0007)                                |
| Ghost bot fitted to your own throws                                                                                                                                     | Pro    | "You from last month"                                                                     |
| Team games (doubles X01 and Cricket)                                                                                                                                    | Later  | Alternating throwers                                                                      |
| Checkout suggestions                                                                                                                                                    | v1     | Curated route table, preferred-double setting                                             |
| Caller voice                                                                                                                                                            | v1     | On-device speech                                                                          |
| Undo and edit any dart in the leg                                                                                                                                       | v1     | Corrections recompute everything (ADR 0006)                                               |

## Input

| Feature                                                       | Status     | Notes                                                                                              |
| ------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| Tap-on-board                                                  | v1         | Records roughly where each dart landed, so heatmaps and replay work from day one                   |
| Keypad                                                        | v1         | Single/double/treble plus number; dart placed at the segment's centre with a low-precision flag    |
| Snap to score (handheld photo after each visit)               | Pro        | In progress: [plan/snap-to-score.md](plan/snap-to-score.md); marking by hand until the model ships |
| Live-view auto-capture                                        | Pro, later | Same model on the preview; snaps when steady and confident                                         |
| Fixed camera on a stand, with placement guide and calibration | Pro, later | Camera release after snap-to-score                                                                 |
| Linked display (iPad or second iPhone)                        | Pro, later | Local network, joined by QR code ([research/multi-device.md](research/multi-device.md))            |
| Second camera to beat occlusion                               | Pro, later |                                                                                                    |
| Soft-tip boards                                               | Later      | Board type is in the data model from day one (ADR 0003)                                            |

## Practice and training

| Feature                                                                                                                                                                       | Status | Notes                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------- |
| Bob's 27                                                                                                                                                                      | v1     |                                                      |
| Count Up                                                                                                                                                                      | v1     |                                                      |
| Around the Clock drill                                                                                                                                                        | v1     |                                                      |
| Personal bests per drill                                                                                                                                                      | v1     | Shown on the Practice tab                            |
| Full drill library (Catch 40, 121, Doubles Lock, JDC Challenge, 100 darts at T20, Checkouts Practice, Random Checkout, 170, Halve-It Sprint, Hubbe, Shanghai, Bullseye drill) | Pro    | [research/training.md](research/training.md)         |
| Skill assessment (JDC-style, monthly)                                                                                                                                         | Pro    | Sets starting levels for scoring, doubles, checkouts |
| Adaptive plan from your weakest area                                                                                                                                          | Pro    |                                                      |
| Suggested drill on the Practice tab                                                                                                                                           | v1     | Simple rule in v1; adaptive in Pro                   |
| Pressure mode (bot sitting on a finish)                                                                                                                                       | Pro    | Practice mode                                        |

## Stats, history and replay

| Feature                                                                 | Status | Notes                                                        |
| ----------------------------------------------------------------------- | ------ | ------------------------------------------------------------ |
| Averages, first-9, checkout %, 100+/140+/180 counts                     | v1     | Per game family stats listed in game-rules.md                |
| History tab with All / Matches / Practice filter and trend chart        | v1     |                                                              |
| Replay: step through a leg visit by visit, board and scoreboard in sync | v1     |                                                              |
| Board heatmap                                                           | v1     |                                                              |
| Aim-relative heatmap, drift and grouping                                | Pro    | Pools misses from every game relative to the intended target |
| Personal aim map                                                        | Pro    | Where to aim for best expected score (Tibshirani model)      |
| Share a replay as an image or short video                               | Later  |                                                              |

## Knowledge

| Feature                                                | Status | Notes                                                    |
| ------------------------------------------------------ | ------ | -------------------------------------------------------- |
| Rules page for every included game, with a Play button | v1     | Generated from the same game definitions the engine runs |
| Checkout guide (routes 2–170, bogey numbers)           | v1     |                                                          |
| Board setup and glossary                               | v1     | Bull 1.73 m, steel-tip oche 2.37 m, diagonal 2.93 m      |
| Checkout trainer                                       | Pro    | Flashcards, then on the board                            |

## App

| Feature                                                          | Status | Notes                                |
| ---------------------------------------------------------------- | ------ | ------------------------------------ |
| Pro theme, light and dark; System / Light / Dark                 | v1     | [design/themes.md](design/themes.md) |
| Chalkboard, Arcade, Heritage and Training themes, light and dark | Pro    | Locked themes show a preview         |
| Ton Up Pro one-time upgrade with Restore                         | v1     | ADR 0004, 0009                       |
| Export and import of your data                                   | v1     | JSON; follows Tippytoe's approach    |
| iCloud sync                                                      | Idea   | Needs a decision against ADR 0001    |

## Open questions

- Default theme on first launch: Pro is the only base theme, so Pro dark (or following the system) is assumed.
