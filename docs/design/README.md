# Design

Ton Up should feel like a serious darts tool that's still fun to pick up: the score is always the clearest thing on screen, and every theme has its own character (pub chalkboard, TV broadcast, arcade, heritage scorecard, training lab).

## Principles

1. **Score first.** The remaining score, the current visit and the checkout hint are readable at a glance from the throw line.
2. **One-handed at the oche.** Main controls sit in the lower part of the screen; the tab bar is at the bottom; touch targets are at least 44 pt.
3. **Everything is correctable.** Any dart in a leg can be edited; corrections never lose data (ADR 0006).
4. **The board is the interface.** One shared board component is used for tap scoring, drills, replay, heatmaps and the Play button.
5. **Every theme is a full theme.** Choosing a theme changes colours, type and the board's look, in light and dark (themes.md).
6. **Accessible by default.** Text contrast at least 4.5:1 (3:1 for large text) in every theme and mode; colours that must be told apart also differ in lightness; Dynamic Type for the main numbers; Reduce Motion respected.

## Docs

- [themes.md](themes.md): the five themes, light and dark, with tokens
- [screens.md](screens.md): navigation and the v1 screens
- [mockups/](mockups/README.md): reference copy of the design canvas source

## Typography (from the mockups)

| Theme | Display | Body |
| --- | --- | --- |
| Chalkboard | Permanent Marker | Kalam |
| Pro | Barlow Condensed (600–800) | Barlow |
| Arcade | Orbitron | Rajdhani |
| Heritage | Playfair Display | Libre Franklin |
| Training | JetBrains Mono | Inter |

All are Google Fonts under the SIL Open Font License, bundled with the app.
