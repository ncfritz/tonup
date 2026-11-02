# 0003: Steel tip first, soft tip later

- Status: Accepted
- Date: 2026-10-29

## Context

Steel-tip (bristle board) and soft-tip (electronic board) darts differ in board geometry, throw distance, some scoring rules, and how a camera sees them. Most camera-scoring research and products target steel tip.

## Decision

v1 and the first camera releases support steel tip only. The board type is part of the game engine and data model from day one, so soft tip is new data, rules options and a new model rather than a rewrite.

| Area | Steel tip (v1) | Soft tip (later) |
| --- | --- | --- |
| Board | Bristle, thin wires; bull at 1.73 m, throw line 2.37 m | Plastic segments with holes, wider spider; throw line 2.44 m |
| Camera detection | Tip sits in fibre; wires are thin | Hole texture and backlit segments; needs its own training data |
| Rules | Bull 25/50 | Many leagues play a "fat bull" (50 everywhere); an engine option |
| Other input | Camera | Many electronic boards report hits over Bluetooth LE, which may beat the camera; investigate before building camera support |

## Consequences

- Board geometry lives in one module used by every input method and every game.
- Rules settings include a board type even while only steel tip is offered.
