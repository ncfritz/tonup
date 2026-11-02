# Game rules

Researched 2026-10-29. 26 games in five families, all playable on a standard steel-tip board with three darts per visit. House rules vary widely in pub games, so each game ships with its common variants as settings toggles. v1: X01, Standard and Cut-Throat Cricket, Around the Clock, Shanghai and Killer; the rest follow as content updates on the same engine (Pro).

The in-app Rules pages are generated from the same game definitions the engine runs, so this doc is the source for both. Scam, Mickey Mouse and the Golf stroke values vary most by region: confirm a preset before building them.

**Scoring basics for every game:** singles count face value, the outer ring doubles, the inner ring trebles, outer bull 25, inner bull 50 (counts as a double).

## X01 family

Count down from a start score to exactly zero; the competitive standard used in PDC events.

| Game | Rules | Common options |
| --- | --- | --- |
| 501 / 301 / 701 / 1001 | Subtract each visit from the start score. Finish on exactly zero with a double or inner bull. Going below zero, landing on 1, or reaching zero without a double is a bust: the visit scores nothing and the turn ends. | Double-in (scoring starts only after a double), straight-in, master-out (double or treble), single-out; legs and sets |
| 201 DIDO | 201 with double-in and double-out; a short, demanding practice format | Recommended as a sharpening drill by Lakeside champion Neil Duff ([Darts World](https://dartsworld.com/?p=12117)) |
| Gotcha | Count up from zero to an exact target (often 301). Land exactly on an opponent's total and their score resets to zero. Overshooting busts. | Double-out finish ([Dolf Darts](https://dolfdarts.com/games/gotcha)) |
| Fifty-One by Fives (All Fives) | A visit scores only if its three-dart total divides by 5; you bank total ÷ 5. First to exactly 51 wins; overshooting busts. A dart off the board voids the visit. | 61, 71 or 101 by fives ([Dolf Darts](https://dolfdarts.com/games/fifty-one-by-fives)) |

**Stats:** 3-dart average, first-9 average, checkout %, darts per leg, 100+/140+/180 counts, highest checkout.

## Cricket family

Close a set of numbers by landing three marks on each (single = 1 mark, double = 2, treble = 3; outer bull 1, inner bull 2). Once you close a number you can score on it until every opponent closes it too.

| Game | Targets | Scoring and win | Notes |
| --- | --- | --- | --- |
| Standard Cricket | 15–20 and bull | Extra marks on a number you've closed (and an opponent hasn't) add its value to your points. Win by closing everything with points equal or ahead. | The US league standard alongside 301 and Baseball ([league rules](https://li-kick.com/rules/65c396fb19d1d08dae30778c)) |
| Cut-Throat | 15–20 and bull | Extra marks add points to every opponent who hasn't closed that number. Lowest points wins once you've closed all. | Best with 3+ players |
| No-Score Cricket | 15–20 and bull | Pure race to close all seven; no points | Good for beginners |
| Tactics | 10–20 and bull | As Standard, more numbers | Longer; rewards treble accuracy |
| Random Cricket | 6 numbers drawn at random, plus bull | As Standard | Fresh each game; can hide numbers until opened |
| Mickey Mouse | Commonly 20 down to 12, then any double, any treble, bull | As Standard, with "any double/treble" as targets | Rules differ by region; offer presets |
| Killer Cricket | Close your own number | Then remove lives by hitting opponents' numbers | Hybrid with Killer ([Dolf Darts](https://dolfdarts.com/games/killer)) |

**Stats:** marks per round (MPR), first to close per number, rounds to close, points per round.

## Target-sequence games

Everyone works through the same list of targets; scoring or penalties depend on what you hit at each step.

| Game | Rules | Common options |
| --- | --- | --- |
| Around the Clock | Hit 1 through 20 in order, then bull. Advance on any hit of the current number. First to finish wins. | Doubles only, trebles only, skip ahead on double (+2) or treble (+3), reverse 20→1 |
| Nine Lives | Around the Clock where a visit that misses the current target with all three darts costs a life; despite the name, players usually get 3. Last player alive or first to finish wins. | Starting lives, reverse order ([Dolf Darts](https://dolfdarts.com/games/nine-lives)) |
| Hare and Hounds | Around the Clock chase: the hare starts on 20, the hound a few numbers behind (often 5). The hound wins by catching up; the hare wins by completing the lap. | Head-start size sets the handicap; one hound vs several hares ([Dolf Darts](https://dolfdarts.com/games/hare-and-hounds)) |
| Shanghai | Round 1 targets 1, round 2 targets 2, and so on (commonly 7 or 20 rounds). Only the round's number scores, at its multiplied value. Single, double and treble of the number in one visit (a "Shanghai") wins instantly. | Round count, no instant win |
| Halve-It | A preset list of targets, one visit each (for example 20, 19, any double, 18, any treble, 17, bull). Hits add their value; missing a target with all three darts halves your total, rounded up. | Custom target lists; "Sprint" list for training ([Wikipedia](https://en.wikipedia.org/wiki/Halve_it)) |
| Bermuda Triangle | A Halve-It variant with a fixed sequence of targets that includes rings and bull segments | Also called Double Down in some sets ([Dolf Darts](https://dolfdarts.com/games/double-down)) |
| Count Up | Fixed number of visits (often 8); add everything. Highest total wins. | Visit count |

**Stats:** hit % per target, darts per target, halvings suffered, Shanghai count.

## Elimination and party games

Social games built around attacking other players; the engine needs per-player ownership of numbers and a lives counter.

| Game | Rules | Common options |
| --- | --- | --- |
| Killer | Each player throws one dart (often weak hand) to draw their number. Hit the double of your own number to become a Killer. Killers then hit opponents' doubles to take lives (usually 3). Hitting your own double as a Killer costs a life or your Killer status. Last player standing wins. | Lives 3–6; any segment counts with double = 2 and treble = 3 lives; hit own number 3 times to qualify; Kamikaze (own hits always hurt) ([Dolf Darts](https://dolfdarts.com/games/killer), [Darts Corner](https://www.dartscorner.co.uk/blog/how-to-play-killer-darts/)) |
| Blind Killer | Killer with secretly assigned numbers; doubles on unowned numbers do nothing, so play becomes deduction | The app can deal numbers privately to each phone ([Dolf Darts](https://dolfdarts.com/games/blind-killer)) |
| Scam | Two players alternate roles: the stopper closes numbers by hitting them, the scorer scores on numbers still open. Roles swap; higher score as scorer wins. | Rules vary; confirm a preset before shipping |

**Stats:** lives taken and lost, darts to become a Killer, own-number accidents. These games are mostly for fun; history matters more than averages.

## Sports-themed games

Popular in the US and in casual play; they map a sport's structure onto board targets.

| Game | Rules | Common options |
| --- | --- | --- |
| Baseball | Nine innings; inning N targets number N. Single = 1 run, double = 2, treble = 3. Most runs after nine wins; a perfect game is 81. Ties go to extra innings. | Bull tiebreak, innings on 11–19 or random ([Dolf Darts](https://dolfdarts.com/games/baseball-darts), [Wikipedia](https://en.wikipedia.org/wiki/American_darts)) |
| Bullseye Baseball | Baseball, but a bull must be hit in the inning before any runs count | Max 6 runs per inning ([Dolf Darts](https://dolfdarts.com/games/bullseye-baseball)) |
| Golf | 9 or 18 holes; hole N targets number N. You may stop after any dart and keep it. A common card: treble 1 stroke, double 2, single 3, miss 5. Lowest total wins. | Stroke values vary widely; par per hole; front/back nine |
| Football (Soccer) | Hit the bull to gain possession, then score goals by hitting doubles. Lose possession on a missed visit. First to 10 goals wins. | 5-goal short game ([Dolf Darts](https://dolfdarts.com/games/football-darts)) |
| Tic-Tac-Toe | Nine targets laid out as a 3×3 grid (bull in the centre). Hitting a target claims its square; three in a row wins. | Require doubles or trebles to claim; random grids |

**Stats:** runs per inning, strokes per hole, goals per possession.

## Board setup and reference

- Bull height 1.73 m (5 ft 8 in); steel-tip throw line 2.37 m (7 ft 9¼ in) from the board face; diagonal check 2.93 m from bull to oche ([WDF rules](https://www.cyberdarts.com/zwdf/wdfrules.html)). Soft tip uses 2.44 m (8 ft) ([Shot Darts](https://www.shotdarts.com/blog/darts-distance-rules-what-you-need-to-know)).
- Bogey numbers that can't be finished in three darts (double out): 169, 168, 166, 165, 163, 162, 159.
- Checkout suggestions use a curated route table (for example 140 = T20, T20, D10), not a search; the mockups' search sometimes picks unusual routes.
- Glossary starters: oche, leg, set, visit, bust, ton, ton-80, madhouse (D1), Shanghai, bed.

## Sources

- [Dolf Darts game encyclopedia](https://dolfdarts.com/games?players=2): rules pages for most games above
- [Halve it, Wikipedia](https://en.wikipedia.org/wiki/Halve_it)
- [American darts and Baseball, Wikipedia](https://en.wikipedia.org/wiki/American_darts)
- [Killer rules, Darts Corner](https://www.dartscorner.co.uk/blog/how-to-play-killer-darts/)
- [Darts World: Fun and Games to Improve Your Darts](https://dartsworld.com/?p=12117)
- [Dart league rules (ADA-based)](https://li-kick.com/rules/65c396fb19d1d08dae30778c)
- [WDF playing rules](https://www.cyberdarts.com/zwdf/wdfrules.html)
