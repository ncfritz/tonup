# Mockups

Source for the interactive mockups on the Claude design canvas "Ton Up — App Design" (linked from [../../README.md](../../README.md)). These files are a reference copy taken on 2026-11-02: they render only inside the design canvas, not as standalone web pages. When the canvas changes, refresh this copy.

## Layout

| Path | What it is |
| --- | --- |
| `canvas/canvas.json` | Canvas index: pages, artboard positions, titles and notes |
| `canvas/*.dc.html` | One artboard each (Design Component format: HTML template plus a small logic class) |

## Artboards by canvas page

| Page | Files |
| --- | --- |
| Themes | `Main` (Chalkboard dark), `ChalkLight`, `Pro`, `ProLight`, `Neon` (Arcade dark), `NeonLight`, `HeritageDark`, `Heritage` (light), `Lab` (Training dark), `LabLight`, `Settings` (interactive theme picker) |
| MVP flow | `M01Home` … `M13Upgrade`: the first full flow, including the camera and linking screens parked for later (`M03Devices` to `M08Correct`) |
| Home navigation | `N1TabBar` (A), `N2Dock` (B), `N3Board` (C), `N4Today` (D), `N5Combined` (E, the chosen design) |
| v1 screens (no camera) | `V1Scoring` (playable 501 vs the bot, tap or keypad), `V1Drill` (playable Bob's 27), `V1Practice`, `V1History`, `V1Rules` |

## Notes

- All screens use the Pro dark palette except the Themes page.
- The scoring mockup's checkout suggestions come from a simple search and sometimes pick unusual routes (140 → T20, T16, D16); the app uses a curated table.
- The bot in `V1Scoring` uses Gaussian scatter (ADR 0007) with a spread that averages about 78.
