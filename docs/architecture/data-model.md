# Data model

Draft from research; the v1 implementation plan turns this into tables. The core idea (ADR 0006): every dart is one event, and scores, stats, history and replay are derived from the log.

## Dart event

| Field                                                 | Purpose                                                                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Session (game or drill), order in the session, player | Ordering and the replay timeline; leg, visit and dart number are derived from the order by the game rules                                                          |
| Board position (x, y in mm from the bull)             | Heatmaps, grouping, replay placement                                                                                                                               |
| Segment, multiplier, score                            | Scoring without re-deriving geometry                                                                                                                               |
| Intended target                                       | Known from game state (Around the Clock's current number, a Killer's target double, a Bob's 27 double, an X01 checkout route); optional tap for X01 scoring visits |
| Input source and precision                            | Tap-on-board, keypad (segment centre, low precision), bot, and later camera (with confidence)                                                                      |
| Corrected flag, timestamp                             | Audit trail; camera training data later                                                                                                                            |
| Optional photo or frame reference                     | Camera modes only, opt-in                                                                                                                                          |

## Other records

- **Session:** game or drill type, rules settings (start score, in/out rules, legs or sets, variants), board type (steel tip in v1; ADR 0003), players and bots, start and end time, result. A ghost bot (Pro analysis) is a bot player whose id carries its fitted scatter (`ghost:<month>:dx,dy,sx,sy,rho`, src/domain/analysis/ghost.ts), so a stored game can keep throwing like it without another table; its level is the nearest bot level. Deleting a session from History removes it and its darts together (the darts table cascades); everything derived is recomputed from what's left, so nothing else needs updating.
- **Player:** local profiles for pass-and-play (name, colour); no accounts.
- **Bot:** level and, for the ghost bot, the fitted scatter.
- **Derived and cached:** per-target hit rates, heatmap bins, personal bests per drill, trend points for the History tab. All rebuildable from events.
- **Settings:** theme and mode, caller voice, preferred doubles for checkout suggestions, default game.

## Conventions

- Board positions are millimetres in board space (bull at 0,0; the 20 straight up), so tap, keypad, bot and camera darts share one coordinate system. Regulation steel-tip ring radii are the source of truth for scoring.
- Times are stored in UTC.
- IDs and the rest follow Tippytoe's conventions (expo-sqlite + Drizzle there), confirmed in the implementation plan.

## Open questions

- How much history to keep per dart for camera releases (photo crops are large).
- Export format: JSON of sessions and events, plus CSV for spreadsheets.
