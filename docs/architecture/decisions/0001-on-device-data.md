# 0001: Store all information on the device

- Status: Proposed (follows Tippytoe's ADR 0001)
- Date: 2026-11-02

## Context

Ton Up records every dart, every game and every practice session. That history is personal and only useful to the player. Competitors that depend on a connection (Autodarts X, Target Omni) are a gap we want to exploit (research/competitors.md), and running no servers keeps the app simple and private.

## Decision

All user data is stored on the device. The app has no backend, no accounts, and no analytics, crash-reporting or other third-party services. Reference data (game rules, checkout routes, drill definitions, the camera model when it ships) is bundled with the app and updated by shipping a new build.

## Consequences

- No sync between devices; backup relies on iOS device backup plus a user-triggered export.
- Camera scoring runs fully on the device (Core ML), and training data leaves the device only when the player exports it.
- Linking a display (later) is device-to-device on the local network (ADR 0008), never through a server.
- Remote matches, iCloud sync or a tonup.app API would each need their own decision.
