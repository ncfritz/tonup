# 0007: Bots throw simulated darts with Gaussian scatter

- Status: Proposed
- Date: 2026-10-29

## Context

Randomising a bot's three-dart total looks fake. Real players aim at a point and miss by some spread, which is why a weak player's darts spray into 1 and 5 around the 20.

## Decision

A bot throws each dart at an aim point with 2D Gaussian scatter, the model from [A Statistician Plays Darts](https://www.stat.cmu.edu/~ryantibs/papers/darts.pdf) (Tibshirani, Price, Taylor). The landing point is scored with the same board geometry as player darts, and produces the same dart events (ADR 0006).

- **Levels:** the scatter radius is calibrated by simulation so each level hits a target 3-dart average (for example 30, 45, 60, 75, 90). Calibrated in M1 for 501 double out: σ = 28.5, 18.4, 13.3, 10.2 and 7.7 mm per axis.
- **Strategy:** the bot follows the checkout table, chooses setup shots, and in Cricket picks targets by game state.
- **Personality (optional):** extra scatter on doubles under pressure, and streakiness.
- **Ghost bot (Pro):** fit the scatter to the player's own recorded dart positions and play "you from last month".

## Consequences

- Bot darts appear on the board in replay like anyone else's.
- In the mockups, a spread of 12 (on a 400-unit board drawing) averaged about 78, near the "about 75" quoted for level 4; real levels need tuning by simulation.
