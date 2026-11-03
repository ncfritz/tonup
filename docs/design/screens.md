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
| Snap to score (capture, mark, review)                                                | Spec, built (S1); not mocked yet          | —                                             |

## Tab bar

A pill floating 22 pt above the bottom edge on `surface`, with a soft shadow. Practice and History on the left, Rules and Settings on the right, icon over label; the selected tab's icon and label use `accent`. The Play button (84 pt circle with a 6 pt `bg` border, centred on the pill so it overhangs its top and bottom edges a little) shows a miniature board; on the Play tab it gets a 2 pt `accent` ring. Screens under the tab bar end their content above it.

On the Play tab, tapping Play again does nothing; Quick start's Start button plays your usual game and the X01 and All games buttons open New game.

## Play (home)

Top to bottom: the TON UP wordmark and "Play" title with a "Camera ready" chip (once the camera exists); a **Game in progress** card with Resume when a game is unfinished; **Quick start** with your usual game ("501 vs DartBot 4 · Best of 5 legs · double out") and a Start button; game shortcuts (X01, Cricket, Killer, each opening New game on that game, and All games); **Pick up where you left off**: Last match (mini heatmap, result, averages, Replay and Rematch) and Last practice (score trend, gap to your best, the double that cost you most, Try again and All drills).

## Scoring (phone)

- Header: leave (the pause icon), game and leg, and a Board / Keypad switch.
- Leaving before the end: with nothing thrown yet, the game simply goes and leaves nothing in History. Once darts are in, a choice: Keep for later (resume it from Play), Discard (deleted with its darts, never in History), or Cancel. Drills work the same way, back to Practice. Bots wait while the choice is up.
- Scoreboard: one row per player with legs and remaining score; the player at the oche has the accent bar. Below it, a strip that reads "You require 140 · T20 · T20 · D10" (a curated checkout route for the darts left), or Bust, Game shot, or No finish yet.
- Visit: three dart slots and the visit total (or BUST).
- Input: the board (tap where the dart landed; numbered markers appear) or the keypad (Single/Double/Treble, 1–20, outer bull, bull).
- A line showing the bot's last visit; Undo, Miss, Next. After the leg: Next leg and Leg summary.

## Snap to score

Pro (ADR 0011). **Camera** is a third input on the scoring screen, beside Board and Keypad: a panel says how many darts to throw, then "Snap the board" before you pull.

- **Capture:** full-screen camera with a dashed circle to fill with the board, coaching ("Fill the circle with the board, from a little to the side"; "Snap, then pull · 3 darts"), a shutter and a close button. The first time, a camera permission prompt; if it was refused, a button to Settings.
- **Mark the board** (no model yet, or the board wasn't found): step by step, a small board shows which point to tap (where the 20/5, 6/13, 3/17 and 11/8 wires meet the outside of the double ring, then the bull). Holding shows a 3× magnifier above the finger. Points that don't make a board start the marking again.
- **Check your darts:** the photo with the found board's rings drawn on it and numbered darts; a row per dart with its score, and "Check" or "On a wire?" where it needs a look. Tap the photo to add a dart, tap a dart then the photo to move it, Remove, "One missed the board", "Mark the board again", Retake, and Confirm with the visit total. Only confirmed darts are recorded; if the visit ends early (a checkout or a bust), the rest aren't.

## Drill in progress (Bob's 27)

Round x/21, the score and personal best with the gap to beat it, the target double highlighted on a muted board, three dart slots, a strip of 21 rounds coloured by hits, and large Hit and Miss buttons with Undo (Board and Keypad input are a switch away). A result card at the end with the score against your best, the drill's stats (for Bob's 27, the costliest double) and Try again. Count Up uses the board or keypad with Next; the Around the Clock drill has Hit and Miss like Bob's 27, as do Checkouts Practice, Doubles Lock, 170 Practice and Bullseye. Checkout drills show a line above the strip with what's left and the darts to do it in ("Finish 87 · 4 darts left") and the route for those darts; Pressure says what the bot is waiting on ("DartBot 4 is on 32 · you need 81"); the assessment says which part you're in. A bust shows in the dart slots.

## Practice tab

Without Pro, a suggested drill (with the reason, for example low checkout % this week). With Pro, **Today's plan** instead: before your first assessment it asks you to take one; afterwards it names your weakest area and level, your levels for scoring, doubles and checkouts, the two doubles you've hit least recently (when doubles are weakest), about how long the session takes, and a warm-up plus two drills with Start buttons, each marked "Done today" once finished. A month after the last assessment it asks for another. Then the drills grouped by skill (Scoring, Accuracy, Doubles, Checkouts, Assessment) with personal bests in `accent`, and the Checkout trainer under Checkouts. Pro drills and the trainer show a lock and open the Pro screen.

## Checkout trainer

Pro. A deck of ten finishes from a range (2–40, 41–100, 101–170). Each card shows a score; Show the route reveals the three-dart route and why it's the route (what the first dart leaves, what a treble missed into its single leaves, and where a split double leaves you). Knew it or Didn't; a card you didn't know comes back once at the end. The end shows how many you knew first time, with "Throw them on the board" (the same finishes as a Random Checkout), New deck and Done.

## History tab

All / Matches / Practice filter; a trend chart (3-dart average over your last 20 X01 matches, or a drill's scores for Practice, with a chip per drill); personal bests (best average, high checkout, Bob's 27, plus Count Up and Around the Clock under Practice); a board heatmap of where your darts landed over the last 30 sessions shown, with the busiest region and the share off the board; and a list of recent sessions. A finished session opens its replay; an unfinished one goes back into the game or drill. Deleting works as in Mail: a half swipe left shows a Delete chip, which asks first; a full swipe (past 60% of the row, with a tick of haptics as it crosses) deletes on release and shows "Deleted …" with Undo for five seconds, after which (or on leaving History) it's gone. Holding a session, or VoiceOver's Delete action, also asks first. Deleting removes the session and its darts for good; stats and personal bests follow from what's left. An **Analysis** button by the title opens Analysis with Pro (and the Pro screen without).

## Analysis

Pro. From your tapped darts with a known aim (the checkout route, the drill's target, T20 otherwise), pooled across every game and drill; keypad darts have no landing point and are left out.

- **Grouping and drift**, filtered by what the darts were aimed at (All, T20, Trebles, Doubles, Bull): a heatmap of where darts land around the aim with your average landing point and the circle half your darts fall inside, the drift ("Drift: 6 mm low and left", or no clear drift when it's under 3 mm or small next to your spread), and your grouping (σ, and the half-your-darts radius).
- **Where to aim:** the personal aim map. Your scatter is fitted as a circle from at least 30 tapped darts (darts at the bull when there are enough); the board marks the aim point with the most expected points per dart, with T20 and the bullseye for comparison. A tight grouping is told T20 is the place.
- **Trends:** the last 12 weeks of X01 average, doubles and trebles hit rates, and grouping, each with this week's figure.
- **Your ghost:** a bot that throws like you did over the last month: drift, spread and their shape fitted from tapped darts, or from your 501 average when there aren't 60 of them. It shows what the ghost averages (and what you did) and starts 501 against it.

## Rules tab

Search (games and glossary terms); quick links to Checkouts, Board setup and Glossary; the games in the app with one-line summaries, each opening its rules page (How to play, Scoring, Winning, Variants, a Play button that opens New game on that game, and a Practise button for Around the Clock and Count Up, which have drills); then the other games' rules by family, with a lock, readable but not playable until Ton Up Pro. Checkouts lists the three-dart route for every score from 170 down, with a score search and the bogey numbers.

## Settings

Appearance (theme and mode; opens the theme picker: System, Light or Dark, and the five themes with a preview swatch in each theme's own colours and font, Pro selectable and the other four locked with "Ton Up Pro" until Pro is owned). Playing: caller on or off, haptics, whether scoring opens on the board or the keypad, and a favourite double for checkout routes (none, D20, D16, D18, D12, D10, D8 or the bull), which new X01 games take. Your data: export everything as a backup file through the share sheet, export games as CSV, and import a backup from Files (games already on the phone are kept; a newer or damaged file is refused with a reason), with a line saying nothing leaves the phone. About: version and build, and **Report a problem**: a box to describe what happened, a list of what the report includes, a preview of the whole report, and Send, which opens the share sheet with a text file (Mail to support@tonup.app, or anywhere). A Ton Up Pro row at the top opens the Pro screen.

## Accessibility

- With VoiceOver on, scoring and drills open on the keypad (or Hit and Miss), since the board needs a finger on a point; the board says which darts are on it and points to the keypad. Keypad keys are read in full ("Treble 20", "Bullseye, 50").
- Dynamic Type: body text grows up to double; display styles stop earlier (score 1.3×, heading 1.4×, title and value 1.5×, overline 1.6×) so scores still fit. Rows and buttons with text grow with it.

## Pro upgrade

What Pro includes (21 more games, the full practice library, deeper analysis, four more themes, camera scoring when it arrives), the App Store's own price on the Buy button ("Get Ton Up Pro · $19.99"), a note that it's a one-time purchase (and shared with Family Sharing), Restore, and a message for each outcome: unlocked, waiting for approval (Ask to Buy), failed, nothing to restore, or the store unreachable. Every lock opens it: Pro games in New game, Pro drills, Pro themes, and Pro games' rules pages. With Pro owned, things that arrive in later milestones say "Coming in an update". If Pro is refunded, the locks come back and a Pro theme falls back to Pro.

New game is two steps.

- **Choose a game:** a search box, **Play again** (your last two distinct set-ups: the game, its settings and the line-up, opening step 2 ready to start), then all 26 games as full-width buttons grouped by family, each with its one-line summary and how many players it takes ("1+", "2"). Pro games carry a Pro tag and open the Pro screen until Pro is owned.
- **Set up:** a card naming the game with its family and summary, "How to play" and "Change game"; a players card with an avatar per player in throwing order (tap one to rename a guest, change a bot's level, move them earlier or remove them) and dashed avatars to add a player or a bot, up to six or the game's limit; then each of the game's settings in its own card as a row of buttons, with a line under it where one helps ("Best of 5 legs"), and **Start {game}**, off until the player count suits the game (Hare and Hounds, Scam and Tic-Tac-Toe are for two). Back returns to step 1. Home's shortcuts and the rules pages' Play button open on step 2.

Quick start and Rematch replay the same game, dealing Killer numbers and Random Cricket's six afresh.

## Open questions
