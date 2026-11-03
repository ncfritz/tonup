# Brand: app icon and launch screen

Both use the Training lab theme's muted board: slate singles (`#2A333C` / `#1A2027`), dull green and brown rings (`#3F5A52` / `#6B4A3F`), grey JetBrains Mono numbers (`#8B98A5`) on the lab background (`#0E1217`). The launch wordmark is JetBrains Mono Bold in `#E6EDF3` with a full-width teal (`#2DD4BF`) underline.

| File                                               | What it is                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/icon.png`                                  | 1024×1024 app icon, opaque (iOS applies the corner mask). The board is set off in the top-right corner, bull near the corner, numbers sweeping the lower left. |
| `assets/splash.png`                                | 1170×2532 (390×844 @3x) launch art: the TON UP wordmark above a board rising from the bottom.                                                                  |
| `assets/brand/icon.svg`, `assets/brand/splash.svg` | Vector sources for the PNGs. Text needs JetBrains Mono Bold installed to render.                                                                               |

`app.config.ts` sets `icon` and configures `expo-splash-screen` with the image full-screen (`enableFullScreenImage_legacy`, `resizeMode: cover`) on `#0E1217`, the same in light and dark mode. The art is close to the 19.5:9 aspect of current iPhones, so `cover` crops only a few points top and bottom. The root layout keeps the splash up until fonts load.

After changing either, run `pnpm ios:sync` (prebuild) so the native project picks them up. The design canvas for these lives in the Ton Up Icons & Launch artifact (Icon D, Launch 3).
