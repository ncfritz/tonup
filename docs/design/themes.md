# Themes

Five themes, each with a light and a dark variant, chosen in Settings › Appearance. **Pro** (light and dark) is in the base app; Chalkboard, Arcade, Heritage and Training are part of Ton Up Pro (ADR 0009) and show a preview with a lock until it is bought. Mode is System, Light or Dark, independent of the theme. (A sixth, Minimal, was explored and dropped.) The mockups are on the design canvas's Themes page; the interactive picker is the "Settings · Theme picker" artboard.

## Tokens

Components use only tokens, never literal colours, so a new theme is data only.

| Token      | Used for                                                                   |
| ---------- | -------------------------------------------------------------------------- |
| `bg`       | Screen background                                                          |
| `surface`  | Cards, rows, buttons, the tab bar                                          |
| `surface2` | Raised or selected cards (the active player's row, dart slots)             |
| `text`     | Primary text and icons                                                     |
| `muted`    | Labels and secondary text                                                  |
| `accent`   | Primary buttons, selected items, active tab, the active player's bar       |
| `onAccent` | Text and icons on `accent`                                                 |
| `danger`   | Bust and checkout strip                                                    |
| `board.*`  | Board segments (light and dark), treble/double ring colours, bull, numbers |
| `dart`     | Dart markers; must stand out against every segment in both modes           |

## Palettes (from the mockups)

| Theme      | Mode  | `bg`      | `surface` | `text`    | `muted`   | `accent`  | `onAccent` |
| ---------- | ----- | --------- | --------- | --------- | --------- | --------- | ---------- |
| Chalkboard | Dark  | `#1f2a24` | `#2a3730` | `#efe9dc` | `#c9d1cb` | `#f2c14e` | `#1f2a24`  |
| Chalkboard | Light | `#fbfaf6` | `#ffffff` | `#1d2b4a` | `#4a5672` | `#c0392b` | `#ffffff`  |
| Pro        | Dark  | `#07090e` | `#151a24` | `#f4f6fa` | `#9aa4b6` | `#e8b931` | `#07090e`  |
| Pro        | Light | `#eef1f6` | `#ffffff` | `#0b1320` | `#4f5b6e` | `#0b1320` | `#e8b931`  |
| Arcade     | Dark  | `#0b0517` | `#150b2a` | `#f3ecff` | `#b9a8dc` | `#ff3ea5` | `#0b0517`  |
| Arcade     | Light | `#fbf3ff` | `#ffffff` | `#24103d` | `#5e4a7d` | `#c4106f` | `#ffffff`  |
| Heritage   | Dark  | `#14231b` | `#1d3126` | `#f1e2bf` | `#b8ab8c` | `#d9a441` | `#14231b`  |
| Heritage   | Light | `#f4ecdb` | `#fbf6ea` | `#1f1a14` | `#5c5243` | `#1d4a34` | `#f4ecdb`  |
| Training   | Dark  | `#0e1217` | `#151b22` | `#e6edf3` | `#8b98a5` | `#2dd4bf` | `#0e1217`  |
| Training   | Light | `#f6f8fa` | `#ffffff` | `#1f2328` | `#59636e` | `#0f766e` | `#ffffff`  |

Theme character:

- **Chalkboard:** a slate in a wood frame with hand lettering and crossed-out earlier scores (dark); a whiteboard with navy and red marker (light).
- **Pro:** a TV broadcast scoreboard with a gold bar for the player at the oche, legs and score columns, a red "you require" checkout strip and match stats.
- **Arcade:** neon pink and cyan glow and a neon-ringed board (dark); lavender with toned-down pink and teal where text must stay readable (light).
- **Heritage:** a cream scorecard with serif type, a visit-by-visit table and the checkout written out (light); bottle-green felt with cream and brass (dark).
- **Training:** a data view that overlays the leg's darts on a muted board with grouping and drift stats (dark charcoal and teal; light off-white with deep teal and burnt orange).

## Rules

- Check contrast per variant: bright accents (gold, neon pink, cyan) need darker shades on light backgrounds, which is why light Pro's accent is navy and light Arcade's is `#c4106f`.
- The board keeps strong contrast between neighbouring segments in every theme so taps and markers stay readable.
- The selected theme and mode are stored in settings; System follows the iPhone's appearance.

## Open questions

- Default on first launch: Pro, following the system appearance (assumed, since it is the only base theme).
- Final `danger`, `surface2` and `board.*` values per theme (taken from the mockups when the theme code is written).
