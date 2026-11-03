# v1 implementation plan

- Status: Accepted; M0–M11 in place: the base app, Pro purchase and all 26 games (2026-11-02)
- Date: 2026-11-02

v1 is the camera-free release (ADR 0005) and includes all of Ton Up Pro except camera scoring (ADR 0009): all 26 games, the full practice library with assessment and adaptive plan, the analysis features, and all five themes, on a $9.99 paid app with a one-time Pro upgrade. The base app is built and checked first, then Pro. This plan sets the stack, the code layout, the core domain design, and sixteen milestones, each ending in something that runs on a phone. Scope comes from [../features.md](../features.md); screens from [../design/screens.md](../design/screens.md).

## 1. Stack

Same as Tippytoe unless noted, so tooling, scripts and patterns can be copied across.

| Concern                | Choice                                                                                                                          | Notes                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Framework              | Expo SDK 58, React Native 0.88, TypeScript (strict, `noUncheckedIndexedAccess`)                                                 | ADR 0002                                                                 |
| Navigation             | expo-router, routes in `src/app/`                                                                                               | Custom floating tab bar with the dartboard Play button                   |
| Styling                | Unistyles 3, ten named themes (`pro-dark`, `pro-light`, …)                                                                      | Adaptive switching off; we pick theme × mode ourselves                   |
| State                  | Zustand for the in-progress game and settings; Drizzle live queries for stored data                                             | Derived values never stored                                              |
| Database               | expo-sqlite + Drizzle ORM, one file, migrations at start                                                                        |                                                                          |
| Board drawing          | react-native-svg                                                                                                                | One `Board` component for scoring, drills, replay, heatmaps, Play button |
| Gestures and animation | react-native-gesture-handler, Reanimated 4                                                                                      | Tap loupe, marker drag, replay scrubber                                  |
| Charts                 | react-native-svg, hand-drawn                                                                                                    | Trend line, hit-rate bars; no chart library                              |
| i18n                   | i18next + ICU                                                                                                                   | English only at launch; every string is a key                            |
| Purchases              | expo-iap (StoreKit 2)                                                                                                           | As Tippytoe's ADR 0021                                                   |
| Caller voice           | expo-speech                                                                                                                     | On-device                                                                |
| Other Expo modules     | expo-haptics, expo-keep-awake (screen stays on during a game), expo-sharing and expo-document-picker (export/import), expo-font |                                                                          |
| Tests                  | Jest (jest-expo), React Native Testing Library, Maestro                                                                         |                                                                          |
| Tooling                | pnpm, ESLint 9 + Prettier, simple-git-hooks + lint-staged                                                                       | `pnpm check` before done                                                 |
| Builds                 | Local, `expo prebuild` + Xcode; TestFlight                                                                                      | No EAS cloud                                                             |
| iOS target             | iOS 18.0                                                                                                                        | Same as Tippytoe                                                         |
| IDs                    | Bundle `app.tonup.ios`; Pro product `app.tonup.pro`                                                                             |                                                                          |

Native modules: none in v1. `modules/` is created for the camera releases.

## 2. Project layout

```
tonup/
├── app.config.ts
├── src/
│   ├── app/                         routes only (thin screens)
│   │   ├── _layout.tsx              fonts, migrations, settings, i18n, theme sync, error boundary
│   │   ├── (tabs)/                  practice · history · index (Play) · rules · settings
│   │   ├── new-game.tsx
│   │   ├── game/[sessionId].tsx     full-screen scoring, tab bar hidden
│   │   ├── drill/[sessionId].tsx
│   │   ├── summary/[sessionId].tsx
│   │   ├── replay/[sessionId].tsx
│   │   ├── rules/[gameId].tsx
│   │   └── pro.tsx                  modal
│   ├── domain/                      pure TS, tests beside code, no React/Expo imports
│   │   ├── board/                   geometry (mm), hit testing, segment centres, boards by type
│   │   ├── darts/                   DartEvent, Hit, visits
│   │   ├── games/                   one folder per family (x01, cricket, sequence, elimination, sports) + registry
│   │   ├── drills/                  one file per drill, assessment, adaptive plan + registry
│   │   ├── analysis/                aim-relative heatmap, drift and grouping, aim map, ghost-bot fit
│   │   ├── checkout/                route table lookup, bogey numbers
│   │   ├── bot/                     Gaussian thrower, strategy, level table
│   │   ├── stats/                   averages, checkout %, hit rates, heatmap bins, PBs
│   │   └── pro/                     what Pro unlocks (games, drills, themes, analysis, camera)
│   ├── features/                    Zustand stores and hooks per feature (game, drill, settings, history)
│   ├── services/                    db, purchases, speech, haptics, export, diagnostics
│   ├── ui/                          Board, BoardLoupe, Keypad, Scoreboard*, DartSlots, TabBar, PlayButton, Chart…
│   ├── content/                     rules index: each game's family and how to play it (text in i18n rules.json)
│   ├── theme/                       palettes.json, tokens, fonts, Unistyles themes, ThemeSync
│   └── i18n/
├── modules/                         empty until the camera releases
├── scripts/                         check-contrast, check-i18n, calibrate-bots, build-checkout-table
├── e2e/                             Maestro flows
└── docs/
```

Rules carried over from Tippytoe: `src/domain` imports nothing from React, Expo or other app layers (ESLint-enforced); platform features only through `@/services/*`; no literal colours or strings in components.

## 3. Domain design

### Board and darts

- Board space is millimetres, bull at (0, 0), the 20 straight up. Steel-tip ring radii: inner bull 6.35, outer bull 15.9, treble 99–107, double 162–170. `hitAt(point, boardType)` returns `{ segment, multiplier, score, isDouble }`; `centreOf(hit)` places keypad darts.
- A **DartEvent** is `{ id, sessionId, playerId, seq, point, hit, intended?, source: 'tap' | 'keypad' | 'bot', precision, corrected, at }`; leg, visit and dart number are derived by the game from the order (`seq`), so they can't disagree with the rules ([../architecture/data-model.md](../architecture/data-model.md)).

### Games as pure reducers (ADR 0006)

Every game implements one interface, so the scoring screen, replay, stats and rules pages are generic:

```ts
interface GameDefinition<Settings, State> {
  id: GameId; // 'x01', 'cricket', ...
  family: 'x01' | 'cricket' | 'sequence' | 'elimination' | 'sports';
  defaults: Settings;
  init(settings: Settings, players: PlayerRef[]): State;
  applyDart(state: State, dart: DartEvent): State; // includes bust, visit, leg and match end
  currentPlayer(state: State): PlayerRef | null; // whose dart is next
  view(state: State): ScoreboardView; // what the UI draws
  targetFor(state: State): Target | null; // intended target, hints, bot aim
  result(state: State): GameResult | null;
}
```

There is no separate end-of-visit step: pressing Next with darts left records those darts as misses, so the log alone decides every visit (a bust ends a visit by itself).

State is rebuilt by folding the session's darts, so undo, editing any dart and replay are the same operation. Folding a whole match is cheap; the active game keeps its current state in Zustand and refolds only on edits.

Drills use the same shape (`DrillDefinition`, `src/domain/drills`) plus a score, which way is better (Bob's 27 and Count Up higher, the Around the Clock drill fewer darts), a progress strip and an early-out flag. They are stored as sessions of kind `drill` for one player (you), and a drill's score is its result, so personal bests are a scan of finished sessions. The suggested drill is a rule over your last five X01 matches: checkout rate under 25% suggests Bob's 27, an average under 45 suggests Count Up, otherwise Around the Clock; with no matches yet it suggests Bob's 27.

Every game also reports its visits in one shape (`visits`) and its summary lines (`stats`), so the scoring screen, caller, undo, replay, summary and the Last match card handle any game. A `ScoreboardView` can carry a game-specific `detail` (Cricket's marks grid) and a `round`; rows carry a `note` (Around the Clock's target, a Killer's number). Single-game games (everything but X01) report leg 0 throughout; legs for Cricket can come later.

M5 defaults, from the rules doc: Cricket Standard with a 20-round limit (best points, then marks, at the limit); Around the Clock any ring, no skipping, finishing on the bull; Shanghai 7 rounds with the instant win; Killer 3 lives, numbers drawn at random when the game starts, and a Killer hitting their own double loses a life. A Shanghai can end level, so a game result's winner can be null (a draw).

### Checkouts

Routes for 2–170 (best route for 1, 2 and 3 darts left, and for master and straight out) are worked out in `src/domain/checkout` by a cost model that follows the standard charts: fewest darts, T20 and T19 setups, D20/D16 over small and odd doubles, and a setup that still leaves a finish if the treble drops into its single. Where a chart prefers another route, a hand-written override wins; the table is reviewed against a published chart before M3. A preferred-double setting breaks ties. The mockups' search-based routes are not used.

### Bot (ADR 0007)

The bot aims at `targetFor(state)` (or the checkout route's next dart), adds 2D Gaussian scatter in millimetres, and produces a normal DartEvent through `hitAt`. `simulateAverage` plays solo legs of 501 double out per level; the scatter table in `src/domain/bot` (σ 28.5, 18.4, 13.3, 10.2 and 7.7 mm) gives averages of about 30, 45, 60, 75 and 90, and a test keeps each within ±3. Bot visits play out dart by dart with a short delay so players see them land.

### Stats

Pure functions over events: 3-dart and first-9 averages, checkout %, 100+/140+/180, marks per round, per-target hit rates, heatmap bins, personal bests. Cached in a table and rebuilt from events when a session changes. The base heatmap counts darts per board region (each segment's four rings and the bulls), so keypad darts count too; the aim-relative heatmap and grouping in M13 use exact positions.

## 4. Data

Drizzle tables (`src/services/db/schema.ts`), one SQLite file with foreign keys on:

- `players`: local profiles and bots (`bot_level`), archived rather than deleted.
- `sessions`: `kind` (game or drill), `type_id` (`x01`, a drill id), settings JSON, board type, started, ended, `abandoned_at` (left on purpose, so Home doesn't offer to resume it), and the result JSON.
- `session_players`: who played, in throwing order.
- `darts`: one row per DartEvent, unique by session and `seq`.
- `stats_cache`: derived values per session, player and key, with a version so a changed computation is recomputed; cleared whenever a session's darts change.
- `settings` and `diagnostics_log` as in Tippytoe.

UUID primary keys; UTC epoch-millisecond times. Migrations are generated with `pnpm db:generate` and applied at launch. `src/features/game/session.ts` is the one place that writes darts: a dart is applied to the game before it is stored, so the rules never see a dart they'd reject; undo deletes the last dart; editing a dart refolds the game and removes later darts that no longer fit the turn order (the UI warns first with `previewEdit`). The most recent session that is neither finished nor abandoned is the one to resume. Export/import as JSON (with a format version) plus CSV of sessions, following Tippytoe's ADR 0008.

Tests run the real migrations against Node's built-in SQLite (`test/sqlite.ts`).

## 5. Milestones

Each milestone ends with `pnpm check` passing and a build on a phone.

| #   | Milestone                    | Delivers                                                                                                                                                                                                                                                                                                                                                                 | Done when                                                                                       |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| M0  | Scaffold                     | Expo app from Tippytoe's tooling (tsconfig, ESLint, Prettier, hooks, Jest, Maestro), `app.config.ts` with `app.tonup.ios`, Pro dark theme, fonts, the five tabs with the floating bar and dartboard Play button, empty screens, dev menu                                                                                                                                 | App installs on a phone and the tabs switch                                                     |
| M1  | Domain core                  | Board geometry and hit testing, DartEvent, X01 engine (all in/out options, legs and sets, busts), checkout table, bot with calibrated levels, X01 stats                                                                                                                                                                                                                  | Unit tests cover every X01 rule and edge case; bot averages within ±3 of each target            |
| M2  | Storage                      | Drizzle schema and migrations, session and dart repositories, resume unfinished session, stats cache                                                                                                                                                                                                                                                                     | A game folded from stored darts matches the live state; migration tests pass                    |
| M3  | Scoring screen (X01)         | Board with tap input, loupe for precise taps, dart markers; keypad; scoreboard and checkout strip; vs bot and pass-and-play up to 6; undo and edit any dart; caller voice; haptics; keep awake; New game; leg and match summary                                                                                                                                          | A full best-of-5 against the bot, with corrections, on a phone                                  |
| M4  | Replay and Home              | Replay screen (scrubber, filter by player); Play home with Quick start, Last match and Last practice                                                                                                                                                                                                                                                                     | Replay of an M3 match matches what happened                                                     |
| M5  | Base games                   | Cricket (Standard, Cut-Throat), Around the Clock, Shanghai, Killer: engines, per-family scoreboards, settings                                                                                                                                                                                                                                                            | Each game playable end to end, with rules tests                                                 |
| M6  | Base practice                | Drill engine; Bob's 27, Count Up, Around the Clock drill screens; personal bests; suggested drill; Practice tab                                                                                                                                                                                                                                                          | Drills record and show personal bests                                                           |
| M7  | History and stats            | History tab (filter, trend chart, PBs, session list), board heatmap                                                                                                                                                                                                                                                                                                      | History reflects games and drills from M3–M6                                                    |
| M8  | Rules and knowledge          | Rules content for every game (all 26, so locked games are readable), rules pages with Play, search, checkout guide, board setup, glossary; Rules tab                                                                                                                                                                                                                     | Every game has a rules page reachable from Rules and New game                                   |
| M9  | Settings and base checkpoint | Settings (Appearance with System/Light/Dark, caller voice, preferred doubles, defaults, export/import, about); theme picker showing the locked themes; contrast check script                                                                                                                                                                                             | **The base app is complete:** internal TestFlight build                                         |
| M10 | Pro purchase and gating      | expo-iap, StoreKit config file, Pro screen, one gating module for games, drills, themes and analysis, locks and previews, Restore, refund fallback                                                                                                                                                                                                                       | Buy, restore and refund behave correctly against the local StoreKit file                        |
| M11 | Pro games                    | The other 21 games: cricket variants (No-Score, Tactics, Random, Mickey Mouse, Killer Cricket), X01 extras (201 DIDO, Gotcha, Fifty-One by Fives), sequence (Nine Lives, Hare and Hounds, Halve-It, Bermuda Triangle, Count Up), elimination (Blind Killer, Scam), sports (Baseball, Bullseye Baseball, Golf, Football, Tic-Tac-Toe); bots for each where it makes sense | Each game has rules tests, a scoreboard and a working rules page                                |
| M12 | Pro practice                 | The rest of the drill library (100 darts at T20, Halve-It Sprint, Shanghai, Bullseye, Checkouts Practice, Doubles Lock, Catch 40, 121, Hubbe, Random Checkout, 170, JDC Challenge), skill assessment, adaptive plan, checkout trainer, pressure mode                                                                                                                     | A monthly assessment produces a plan that picks drills from the weakest area                    |
| M13 | Pro analysis                 | Aim-relative heatmap, drift and grouping, personal aim map (scatter fit from darts at the bull), trends, ghost bot fitted to your own darts                                                                                                                                                                                                                              | Analysis matches hand-computed results on fixture data; ghost bot's average tracks the player's |
| M14 | Pro themes                   | Chalkboard, Arcade, Heritage and Training in light and dark: palettes, fonts, themed board drawing and markers                                                                                                                                                                                                                                                           | Contrast check passes for all ten palettes; every screen reviewed in each theme                 |
| M15 | Release prep                 | Accessibility pass (VoiceOver on board and keypad, Dynamic Type), diagnostics and Report a problem, Maestro flows for the main paths, app icon and launch screen, privacy label, App Store listing (Pro says camera scoring is coming), TestFlight                                                                                                                       | TestFlight build with no known blockers                                                         |

M1 and M2 can run alongside M0's UI work; M5–M8 are largely independent once M3 exists; M11–M14 are independent of each other once M10 exists.

**Parallel track (not blocking v1):** check the DeepDarts dataset licence, train a baseline keypoint model on a Mac, and measure it on photos of a real board. This de-risks the snap-to-score release.

## 6. Testing

| Layer            | Tool                         | Covers                                                                                                             |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Domain           | Jest                         | Hit testing at ring and wire edges, every game's rules and variants, checkout table, bot calibration bounds, stats |
| Fold equivalence | Jest                         | Random dart sequences: live state equals refolded state; edits recompute correctly                                 |
| Database         | Jest with test SQLite        | Migrations; save and reload sessions; export/import round trip                                                     |
| Components       | React Native Testing Library | Board tap mapping, keypad, scoreboard states, accessibility labels                                                 |
| End to end       | Maestro                      | Play 501 vs bot to the end; Bob's 27; replay; theme switch; Pro purchase with the StoreKit file                    |
| Themes and i18n  | scripts                      | Contrast for ten palettes; missing or unused keys                                                                  |

## 7. Risks

| Risk                                                    | Mitigation                                                                                                                                                                                    |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tapping small doubles and trebles accurately on a phone | Press-and-hold loupe showing a magnified board under the finger, release to place; drag a marker to adjust; keypad always one tap away                                                        |
| Board rendering cost (82 segments, markers, heatmap)    | Static board drawn once and cached; markers and heatmap on separate layers                                                                                                                    |
| Game rule variants multiply                             | Variants are settings on one engine per game, covered by table-driven tests                                                                                                                   |
| Five themes × two modes is a lot of design work         | Screens use tokens from M0; the Pro theme ships in the base app and the other four in M14 from the mockup palettes                                                                            |
| v1 scope is large with all of Pro included              | The base app is a checkpoint (M9, internal TestFlight) before Pro work; Pro milestones are independent, so games and drills can also slip to content updates without changing the Pro promise |
| Pub-game rules vary by region                           | Presets chosen in M11 (docs/data/game-rules.md → Presets in the app); variants are settings, so house rules can be added later                                                                |

## 8. Decisions

Settled 2026-11-02 (ADR 0009): $9.99 paid app; one-time Ton Up Pro upgrade at $19.99 (Family Sharing on) holding the other games, practice modes, themes, analysis and camera scoring; all of Pro except the camera ships in v1.

Still open:

- **Base theme:** this plan assumes Pro (light and dark) is the free theme and the default, following the system appearance.
- **Languages at launch:** English only, with i18n in place (assumed).
- **Seller account:** individual or LLC before the first external TestFlight build.

## Next steps

1. Settle the open decisions above.
2. Promote the proposed ADRs this plan relies on (0001, 0006, 0007); the stack is ADR 0010.
3. Finish M0: run the scaffold on a phone (`pnpm install`, then `pnpm ios`) and check the tabs.
4. Review the checkout table against a published chart (`src/domain/checkout`, overrides at the top).
5. Play a best-of-5 against the bot on a phone with a few corrections, then replay it (the M3 and M4 done-whens).
6. Base checkpoint: run through the whole app on a phone, then make an internal TestFlight build (`pnpm ios:release` for a device build; archive in Xcode for TestFlight).
7. Check Pro against the local StoreKit file: run from Xcode (⌘R), buy, then refund in Debug › StoreKit › Manage Transactions and come back to the app; restore after deleting and reinstalling.
8. Play each of the Pro games on a phone and confirm the presets in docs/data/game-rules.md.
9. Start M12.
