# Ton Up — notes for coding agents

iOS darts app: scoring games against friends or a bot, practice drills, game rules, and later camera scoring. Read `docs/README.md` first; decisions are in `docs/architecture/decisions/` and screen specs in `docs/design/screens.md`.

## Stack

Expo (React Native, TypeScript) with expo-router, built locally like Tippytoe (`../tippytoe`), which is the reference for project layout, tooling and conventions. The exact stack is set in the v1 implementation plan; until then, follow Tippytoe's choices unless a Ton Up decision record says otherwise.

Expo changes between SDKs: check the versioned docs and the installed package types rather than memory.

## Rules that matter here

- **No cloud services and no data leaving the device** (ADR 0001). No accounts, analytics or crash-reporting services; builds are local.
- Every dart is recorded once as an event; scores, stats, history and replay are derived from that log (ADR 0006). Game rules are pure functions over the log, with tests beside the code.
- Board geometry and scoring are shared by every input method (tap-on-board, keypad, and later the camera), and the board type is part of the data model so soft tip can follow (ADR 0003, 0005).
- Use theme tokens and i18n keys; no literal colors or user-facing strings (docs/design/themes.md).
- Keep the docs current: update them when behavior or decisions change.
