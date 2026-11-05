# Stats and charts

- Status: Built (2026-11-05); mockups on the design canvas "Ton Up — Stats and charts"
- Builds on: [screens.md](screens.md), [../data/game-rules.md](../data/game-rules.md) (each family's stats), [../research/training.md](../research/training.md), ADR 0006 (everything is derived from the dart log)

What each game, each drill and the player as a whole can show, and the charts that show it. It starts from what's already built and lists what could be added.

## What the data allows

Every dart is an event with its hit (segment and ring), the target it was aimed at, a time, the player and the visit. Tapped and camera darts also have a landing point in millimetres; keypad darts only have their segment. So:

- **Every input** supports anything that counts hits: averages, rates per target, per double, per number, per round, closing order, misses and busts, time between sessions.
- **Tapped and camera darts only** support anything about position: aim-relative heatmaps, drift, grouping, where misses go around a treble, the aim map, the ghost.
- **Bot darts** never count toward your stats; they count toward head-to-head records.

## Charts to build once and reuse

| Chart                    | Shows                                                                                           | Used by                                          | Built?                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| **Board heatmap**        | Where darts landed, shaded by region                                                            | Summary, History, drills                         | Yes                      |
| **Aim-relative heatmap** | Landing points around the aim, with drift and the half-your-darts circle                        | Analysis                                         | Yes (Pro)                |
| **Trend line**           | One number over sessions, with your best marked                                                 | History, Analysis                                | Yes (no best marker yet) |
| **Worm**                 | Score left (or points) after each visit, one line per player                                    | X01, Gotcha, Fives, Hare and Hounds              | New                      |
| **Visit histogram**      | How visit totals spread: under 40, 40s … 100+, 140+, 180                                        | X01, Count Up, T20                               | New                      |
| **Number wheel**         | The board's twenty numbers (and bull) coloured by a rate per number: hit %, darts needed, marks | Clock, Shanghai, Cricket, Halve-It               | New                      |
| **Double ladder**        | Each double's attempts and hit %, best to worst                                                 | X01 checkouts, Bob's 27, doubles drills, overall | New                      |
| **Closing grid**         | Numbers down the side, rounds across: when each player closed each number                       | Cricket family, Scam                             | New                      |
| **Round bars**           | Points (or runs, strokes, marks) per round, per player                                          | Shanghai, Baseball, Golf, Halve-It, Cricket MPR  | New                      |
| **Miss split**           | Where misses at a treble went: the bed, high, low, left neighbour, right neighbour              | T20 and treble drills, overall                   | New (tapped darts only)  |
| **Session grid**         | Drill steps across, recent sessions down, each cell shaded by that step's score                 | Bob's 27, Checkouts Practice, Catch 40, JDC      | New                      |
| **Calendar**             | Days you played or practised, a cell per day, with streaks                                      | Practice, overall                                | New                      |
| **Skill lines**          | Assessment levels for scoring, doubles and checkouts over time                                  | Assessment, overall                              | New (Pro)                |

Charts follow the theme's tokens (accent for "you", muted for others), have an accessible summary sentence, and fall back to a short table when there are too few points to draw.

## Per game

Every game's match summary shows its stats table (built), a board heatmap of each player's darts (built) and Replay (built). Below, what each family adds. **Bold** is new.

### X01 (501, 301, 701, 201 Double In Double Out)

- **Stats:** 3-dart average, first-9 average, checkout %, highest checkout, best leg, 100+, 140+ and 180 counts (built); **darts per leg, busts, doubles hit by double, average leave after scoring (what you leave yourself on a finish), 9-dart average by leg**.
- **Charts:** **worm per leg**, **visit histogram**, **double ladder** from your checkout attempts, a **leg table** (darts, average, checkout, who threw first).
- **History:** average and checkout % trends (average built), **first-9 trend**, **best leg and highest checkout over time**.

### Cricket family (Cricket, Cut-Throat, Tactics, No-Score, Random, Mickey Mouse)

- **Stats:** marks per round, marks, points, darts (built); **first to close per number, rounds to close everything, 5-mark rounds and above, three-in-a-bed (three marks on one number in a visit), bulls hit**.
- **Charts:** **closing grid**, **round bars** of marks per round, a **number wheel** of marks per number.
- **History:** **MPR trend**, **win rate by variant**.

### Around the Clock and Nine Lives

- **Stats:** darts, hit %, number reached (built); **darts needed per number, slowest three numbers, lives lost per number (Nine Lives)**.
- **Charts:** **number wheel** of darts needed per number; **lives line** for Nine Lives.

### Shanghai

- **Stats:** points, hit %, Shanghais (built); **hit % per number, best round**.
- **Charts:** **round bars**, **number wheel** of hit %.

### Killer family (Killer, Blind Killer, Killer Cricket)

Mostly for fun, so results and records matter more than rates.

- **Stats:** darts to become a Killer, lives taken, lives left (built); **own-number accidents, lives lost to each opponent, who knocked out whom**.
- **Charts:** **lives line**, one line per player falling as lives go.
- **History:** **wins and knock-outs by opponent**.

### Gotcha, Fifty-One by Fives, Count Up

- **Stats:** points, Gotchas, scoring visits (built); Count Up's average (built); **best visit, visits that scored nothing (Fives)**.
- **Charts:** **worm** (Gotcha and Fives, with knock-backs marked), **visit histogram** (Count Up).

### Halve-It and Bermuda Triangle

- **Stats:** points, halvings (built); **points per target, which targets halve you most**.
- **Charts:** **round bars** with the halvings marked.

### Hare and Hounds, Scam

- **Hare and Hounds:** **worm** of both positions round the board (the chase); **steps per visit**.
- **Scam:** **closing grid** of who stopped which number; **points per innings, numbers stopped per visit**.

### Baseball, Golf, Football, Tic-Tac-Toe

- **Baseball:** runs and runs per inning (built); **box score** (innings across, runs per player), **best inning**.
- **Golf:** strokes and strokes per hole (built); **scorecard** (holes across), **how often you made 1, 2, 3 and 5**.
- **Football:** goals (built); **darts to win the ball, darts per goal**.
- **Tic-Tac-Toe:** squares (built); **darts per square claimed, the order squares were won**.

## Per drill

Every drill already has its score, personal best, a result screen with its own stats, and the step strip. A **drill page** (tap a drill on the Practice tab) would give each one:

- a **trend line** of its scores with your best marked and the average of the last ten;
- **sessions, best, average and last** in four numbers;
- a **calendar** of the days you did it;
- the drill-specific view below.

| Drill                                           | Drill-specific view                                                                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Bob's 27                                        | **Session grid** of hits per double; **double ladder**; costliest double (built)                                                        |
| Count Up, 100 darts at T20                      | **Visit histogram**; **miss split** at T20; treble rate trend                                                                           |
| Around the Clock, Shanghai                      | **Number wheel** of darts needed or hit %                                                                                               |
| Bullseye                                        | **Aim-relative heatmap** at the bull; bullseye share of bull hits                                                                       |
| Halve-It Sprint                                 | **Round bars** by target; halvings per target                                                                                           |
| Checkouts Practice, Doubles Lock                | **Double ladder**; fall-backs per lock (Doubles Lock)                                                                                   |
| Catch 40, Hubbe, 121, Random Checkout, Pressure | **Finish rate by score band** (41–60, 61–80, 81–100, 101–130, 131–170); darts per finish; **the finishes you miss most** (a short list) |
| 170 Practice                                    | Darts per success trend; which of T20, T20 and the bull costs most                                                                      |
| JDC Challenge                                   | **Session grid** of the three parts; part scores over time                                                                              |
| Skill assessment                                | **Skill lines**; this month against last month for each part                                                                            |

## Overall: a "You" page

The overall view pools every game and drill. Some of it is on History and Analysis now; a single page would gather it.

- **Headline numbers:** darts thrown, legs and games won, 180s, highest checkout, best average, practice streak.
- **Form:** X01 average and checkout % trends (built on History), **first-9 trend**, **last five results**.
- **Doubles:** a **double ladder** across everything, drawn on the double ring of a **number wheel**, with your favourite (most hit) and worst doubles.
- **Trebles:** treble rate trend and the **miss split** at T20 (tapped darts).
- **Board:** the board heatmap (built), aim-relative heatmap and drift (built, Pro), the aim map (built, Pro).
- **Activity:** **calendar** of play and practice with streaks; **time spent** per week.
- **Opponents:** **head-to-head** against each guest and each bot level (won, lost, averages); **win rate by bot level**, which also suggests when to move up a level.
- **Records:** every personal best in one list, with the date set.
- **Skills:** **skill lines** from the assessment (Pro).

## Free and Pro

Following ADR 0009 (play and the basics are free; depth is Pro):

- **Free:** every game's stats table, heatmap and replay; the worm, visit histogram, closing grid, round bars and number wheel on match summaries; History's trends and personal bests; the drill page for the free drills; head-to-head; the calendar.
- **Pro:** the double ladder and miss split; session grids; the drill page for Pro drills; skill lines; everything position-based (aim-relative, drift, aim map, ghost); the full "You" page.

## Where things appear

| Place          | What it gains                                                                     |
| -------------- | --------------------------------------------------------------------------------- |
| Match summary  | The game's charts under its stats table                                           |
| Replay         | A worm (or the game's chart) under the board, following the scrubber              |
| History        | A game filter (not just Matches and Practice), with that game's trend and records |
| Practice       | Drill pages from each drill row                                                   |
| Analysis (Pro) | Becomes the "You" page, or "You" sits on History with Analysis as its Pro part    |

## Suggested order

1. The chart kit: worm, visit histogram, number wheel, round bars, closing grid, double ladder, with summary sentences for VoiceOver.
2. Match summary charts for X01 and the Cricket family (the most played), then the rest.
3. Drill pages with the trend, four numbers and calendar for every drill, then the drill-specific views.
4. The "You" page: headline numbers, doubles, opponents, records.
5. Pro depth: miss split, session grids, skill lines.

## Time range

Drill pages and You share one range control: **30 days, 60 days, 90 days** (one tap each) and **Custom**, which opens a sheet with from and to dates, a month calendar, and This year and All time shortcuts. The choice is remembered. Match summaries and Replay cover one match, so they have no range. (Decided 2026-11-05.)

## Decided

- **You** is its own page, opened from a button by History's title; Analysis stays the Pro screen it links to.
- **Replay** follows along with the worm only (for games that have one).
- A drill's row on Practice opens its drill page, which has the Play button; Today's plan, the suggested drill and Try again still start a drill directly.

## Where it lives in the code

- `src/domain/stats/charts.ts`, `games.ts` and `calendar.ts`: the figures (worm, visit bands, target rates and the double ladder, closing grid, round totals, miss split, trend, finish bands, days, streaks, ranges), with tests.
- `src/ui/charts`: the chart kit (Lines, Bars, NumberWheel, Ladder, CellGrid, ClosingGrid, Calendar, MissSplit, RoundTable, ChartCard), coloured from theme tokens.
- `src/features/stats`: what each screen charts (`summary.ts`, `drill.ts`, `you.ts`), the range picker and the shared cards.
- Screens: `src/app/summary/[sessionId].tsx`, `replay/[sessionId].tsx`, `drill-stats/[drillId].tsx`, `you.tsx`.

## Per-game extras

- **Killer:** a knock-outs card: lives each player took and from whom, lives lost to their own double, and the round and player that put each one out.
- **Football:** the goals worm, and darts to win the ball, darts per goal and times each player won it.
- **Tic-Tac-Toe:** the grid as it ended, each square numbered in the order it was won, and darts per square.
- **Scam:** which of the stopper's visits closed each number (a grid per inning), numbers stopped per visit, and the points worm.
- **History:** under Matches, a chip per game you've played; choosing one shows that game's headline stat as the trend, games played, games won and your best, and lists only that game.
