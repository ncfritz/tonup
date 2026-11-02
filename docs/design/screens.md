# Screens

Navigation is option E from the canvas's Home navigation page: a floating tab bar with **Practice · History · Play · Rules · Settings**. Play is a raised round button in the middle, drawn as a small dartboard in shades of the theme's gold with a "PLAY" label, and the Play tab is the home screen. During a game or drill the tab bar is hidden and a pause button returns home.

| Screen                                                                               | Status                                    | Canvas artboard (page)                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------------------- |
| Play (home)                                                                          | Spec v1                                   | E · Combined (Home navigation)                |
| New game                                                                             | Spec v1                                   | 2 · New game (MVP flow)                       |
| Scoring: tap the board or keypad                                                     | Spec v1, playable mock                    | Scoring · tap the board (v1 screens)          |
| Leg and match summary                                                                | Spec v1                                   | 9 · Leg summary (MVP flow)                    |
| Replay                                                                               | Spec v1, playable mock                    | 10 · Replay (MVP flow)                        |
| Practice tab                                                                         | Spec v1                                   | Practice tab (v1 screens)                     |
| Drill in progress (Bob's 27)                                                         | Spec v1, playable mock                    | Practice · Bob's 27 in progress (v1 screens)  |
| History tab                                                                          | Spec v1                                   | History tab (v1 screens)                      |
| Rules tab and a rules page                                                           | Spec v1                                   | Rules tab (v1 screens); 12 · Rules (MVP flow) |
| Settings › Appearance                                                                | Spec v1                                   | Settings · Theme picker (Themes)              |
| Pro upgrade                                                                          | Spec v1                                   | 13 · Pro upgrade (MVP flow)                   |
| Devices, Link a display, Camera placement, Calibration, iPad scoring, Correct a dart | Parked for the camera releases (ADR 0005) | 3–8 (MVP flow)                                |
| Snap to score (capture, result, missed-dart prompt)                                  | Later; not mocked yet                     | —                                             |

## Tab bar

A pill floating 22 pt above the bottom edge on `surface`, with a soft shadow. Practice and History on the left, Rules and Settings on the right, icon over label; the selected tab's icon and label use `accent`. The Play button (84 pt circle with a 6 pt `bg` border, rising 34 pt above the pill) shows a miniature board; on the Play tab it gets a 2 pt `accent` ring. Screens under the tab bar end their content above it.

On the Play tab, tapping Play again does nothing; Quick start's Start button plays your usual game and the X01 and All games buttons open New game.

## Play (home)

Top to bottom: the TON UP wordmark and "Play" title with a "Camera ready" chip (once the camera exists); a **Game in progress** card with Resume when a game is unfinished; **Quick start** with your usual game ("501 vs DartBot 4 · Best of 5 legs · double out") and a Start button; game shortcuts (X01, Cricket, Killer, each opening New game on that game, and All games); **Pick up where you left off**: Last match (mini heatmap, result, averages, Replay and Rematch) and Last practice (score trend, gap to your best, the double that cost you most, Try again and All drills).

## Scoring (phone)

- Header: pause, game and leg, and a Board / Keypad switch.
- Scoreboard: one row per player with legs and remaining score; the player at the oche has the accent bar. Below it, a strip that reads "You require 140 · T20 · T20 · D10" (a curated checkout route for the darts left), or Bust, Game shot, or No finish yet.
- Visit: three dart slots and the visit total (or BUST).
- Input: the board (tap where the dart landed; numbered markers appear) or the keypad (Single/Double/Treble, 1–20, outer bull, bull).
- A line showing the bot's last visit; Undo, Miss, Next. After the leg: Next leg and Leg summary.

## Drill in progress (Bob's 27)

Round x/21, the score and personal best with the gap to beat it, the target double highlighted on a muted board, three dart slots, a strip of 21 rounds coloured by hits, and large Hit and Miss buttons with Undo. A result card at the end with Try again.

## Practice tab

A suggested drill (with the reason, for example low checkout % this week), then drills grouped by skill (Scoring, Accuracy, Doubles and checkouts) with personal bests in `accent`. Pro drills show a lock and open the Pro screen.

## History tab

All / Matches / Practice filter; a trend chart (3-dart average over recent X01 matches, or the drill score for Practice); personal bests (best average, high checkout, Bob's 27); and a list of recent sessions linking to Replay or the drill.

## Rules tab

Search; quick links to Checkouts, Board setup and Glossary; the games in the app with one-line summaries, each opening its rules page (with a Play button); then chips for the other games' rules.

## Open questions

- Snap-to-score screens: capture with coaching, result with markers, the missed-dart prompt.
- Settings beyond Appearance (caller voice, preferred doubles, input defaults, data export, Pro).
