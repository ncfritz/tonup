# Practice and training

Researched 2026-10-29. The drills are well established and every competitor ships some of them; the opportunity is turning them into a coached program that picks drills from your weaknesses and shows progress over weeks. Doubles deserve the most weight: one guide notes Simon Whitlock reportedly spends 75–80% of practice time on doubles ([Dolf Darts](https://dolfdarts.com/games/doubles-snakes-and-ladders)).

v1 ships Bob's 27, Count Up and Around the Clock; the rest are Pro ([../features.md](../features.md)).

## Drill library

| Skill      | Drill                                                                                           | How it works                                                                                                                                                      | Benchmark                         |
| ---------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Scoring    | Count Up                                                                                        | Fixed number of visits (often 8), maximize the total                                                                                                              | Personal best and 3-dart average  |
| Scoring    | 100 darts at T20                                                                                | 100 darts at one target, track the hit rate                                                                                                                       | T20 hit %                         |
| Scoring    | [Halve-It / Sprint Half-It](https://dartsworld.com/2020/03/23/new-game-a-day-ii-sprint-half-it) | One visit each at 20, 19, 18, 17, any double, any treble, bull; a miss halves the total                                                                           | Finish without being halved       |
| Accuracy   | Around the Clock                                                                                | Hit 1 to 20 then bull in order; variants for doubles or trebles only                                                                                              | Darts to finish                   |
| Accuracy   | Shanghai                                                                                        | Three darts at each number; single, double and treble in one visit wins outright                                                                                  | Total score                       |
| Accuracy   | Bullseye drill                                                                                  | 30 darts at the bull                                                                                                                                              | Bull hit %                        |
| Doubles    | [Bob's 27](https://www.harrowsdarts.com/blogs/guides/darts-practice-routines-to-try-at-home)    | Start at 27; three darts at D1 through D20, then bull; each hit adds the double's value, a round with no hits subtracts it; reaching zero or below ends the drill | Finish above zero                 |
| Doubles    | [Checkouts Practice](https://dolfdarts.com/games/checkouts-practice)                            | Work down the key doubles D20, D18, D16 … D2                                                                                                                      | Total points                      |
| Doubles    | [Doubles Lock](https://dolfdarts.com/games/doubles-lock)                                        | D20 to D1 with checkpoints you fall back to on a miss                                                                                                             | Under 120 darts at club level     |
| Checkouts  | [Catch 40](https://dolfdarts.com/games/catch-40)                                                | Check out every score 61–100, max 6 darts each; 3/2/1 points by darts used                                                                                        | 40 points                         |
| Checkouts  | [121](https://dolfdarts.com/games/121)                                                          | Finish 121 within a dart limit, then the target climbs                                                                                                            | Highest target reached            |
| Checkouts  | Hubbe                                                                                           | Checkouts 101–130, three darts each                                                                                                                               | Total points                      |
| Checkouts  | [Random Checkout](https://dolfdarts.com/games/random-checkout)                                  | A random target 40–170 in three darts                                                                                                                             | Completion % and darts per finish |
| Checkouts  | [170 Practice](https://dolfdarts.com/games/170-practice)                                        | T20, T20, bull                                                                                                                                                    | Under 20 darts is strong          |
| Assessment | [JDC Challenge](https://www.godartspro.com/?p=2513)                                             | Junior Darts Corporation grading: Shanghai 10–15, doubles round, Shanghai 15–20                                                                                   | Grade                             |

## Experiences built on the drills

- **Skill assessment** (Pro): a 15-minute JDC-style test that sets starting levels for scoring, doubles and checkouts, repeated monthly.
- **Adaptive plan** (Pro): the app picks today's 20–30 minute session from the weakest area, for example "D16 at 18%, D20 at 31%: today is Doubles Lock on even doubles."
- **Suggested drill** (v1): a simple rule on the Practice tab (for example Bob's 27 when checkout % is low).
- **Target practice with zones:** score by distance from the aim point, not only the segment, so grouping shows improvement before hit rates move. Most useful with camera positions.
- **Personal aim map** (Pro): from about 50 darts at the bull, estimate the player's scatter and show where to aim for the best expected score, per [A Statistician Plays Darts](https://www.stat.cmu.edu/~ryantibs/papers/darts.pdf) (Tibshirani, Price, Taylor).
- **Checkout trainer** (Pro): flashcards for routes, then on the board, with a "why this route" note.
- **Pressure mode** (Pro): a bot sitting on a finish, so you must check out in one visit.
- **Streaks and weekly trends** to make solo practice sticky.

## Rules in the app

Chosen in M12 (`src/domain/drills`); confirm against your own practice before release.

- **100 darts at T20:** exactly 100 darts; the score is trebles hit, with the 3-dart average alongside.
- **Halve-It Sprint:** one visit each at 20, 19, 18, 17, any double, any treble and the bull; a blank visit halves the score (rounded up).
- **Shanghai drill:** a visit at each number from 1 to 20, scored number × ring; a Shanghai is counted but doesn't end the drill.
- **Bullseye:** 30 darts; either bull counts, bullseyes are shown too.
- **Checkouts Practice:** three darts at each even double from D20 to D2; each hit scores the double's value.
- **Doubles Lock:** D20 down to D1; a hit moves you down one, a visit with no hit sends you back to the last lock reached (D20, D15, D10, D5). Scored by darts; it stops at 300.
- **Catch 40:** 61 to 100 with six darts each, double out with busts; 3 points in two darts, 2 in three, 1 in four to six.
- **121:** ten tries of nine darts; a finish moves the target up one. The score is the highest target finished.
- **Hubbe:** 101 to 130, one visit each, a point per finish.
- **Random Checkout:** twenty finishes from 40 to 170 dealt at the start, one visit each.
- **170 Practice:** T20, T20 and the bull in that order; scored by darts, stops at 150.
- **JDC Challenge:** Shanghai on 10–15 (number × ring, 100 bonus for a Shanghai), one dart at each double and the bull (50 a hit), then Shanghai on 15–20.
- **Pressure:** ten legs dealt from 41 to 130 with the bot waiting on a double; one visit to finish each. The score is legs won.
- **Skill assessment:** ten visits at T20 (level by 3-dart average: under 30, 42, 55, 70), three darts at each of D20, D16, D10, D8, D18, D12, D4, D2 (level by hit rate: under 8%, 16%, 25%, 35%), and one visit at each of 32, 50, 61, 76, 87, 100 (level by finishes: 0, 1, 2, 3–4, 5–6). The score is the sum of the three levels.
- **Adaptive plan:** the weakest level (ties go to doubles, then checkouts) picks two drills from that area, rotating daily (levels 1–2 stay with the easier three), after a warm-up from Around the Clock, Bullseye and Shanghai. The doubles named are the two lowest hit rates with at least six darts aimed at them in your last 30 sessions.
