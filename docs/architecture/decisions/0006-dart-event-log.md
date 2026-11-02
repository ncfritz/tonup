# 0006: Record every dart as an event; derive everything else

- Status: Proposed
- Date: 2026-10-29

## Context

We want heatmaps, history and replay for every kind of game and drill, and the ability to correct any dart in a leg. Storing per-game score tables would mean a different schema for every game and no replay.

## Decision

Each dart is stored once as an event (fields in [../data-model.md](../data-model.md)). Every game and drill is a pure function from its ordered dart events (plus its settings) to state: scores, whose turn, busts, winners. Stats, history, heatmaps and replay are all derived from the same log.

## Consequences

- Corrections and undo edit or remove events, and everything downstream recomputes.
- Replay needs no extra recording: it re-runs the game function up to a chosen visit.
- Game rules are easy to unit test (events in, state out), and the Rules pages can be generated from the same game definitions.
- Aggregates (per-target hit rates, heatmap bins, personal bests) are cached and rebuilt from events when needed, so thousands of darts stay fast.
