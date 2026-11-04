# Brand: app icon and launch screen

Both use the Training lab theme's muted board: slate singles (`#2A333C` / `#1A2027`), dull green and brown rings (`#3F5A52` / `#6B4A3F`), grey JetBrains Mono numbers (`#8B98A5`) on the lab background (`#0E1217`). The launch wordmark is JetBrains Mono Bold in `#E6EDF3` with a full-width teal (`#2DD4BF`) underline.

| File                                               | What it is                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/icon.png`                                  | 1024×1024 app icon, opaque (iOS applies the corner mask). The board is set off in the top-right corner, bull near the corner, numbers sweeping the lower left. |
| `assets/splash.png`                                | 1170×2532 (390×844 @3x) launch art: the TON UP wordmark above a board rising from the bottom.                                                                  |
| `assets/brand/icon.svg`, `assets/brand/splash.svg` | Vector sources for the PNGs. Text needs JetBrains Mono Bold installed to render.                                                                               |

`app.config.ts` sets `icon` and configures `expo-splash-screen` with the image full-screen (`enableFullScreenImage_legacy`, `resizeMode: cover`) on `#0E1217`, the same in light and dark mode. The art is close to the 19.5:9 aspect of current iPhones, so `cover` crops only a few points top and bottom. The root layout keeps the splash up until fonts load.

## TU Capture

The capture app (ADR 0012) has its own pair so the two are easy to tell apart on a home screen: the same board with teal (`#2DD4BF`) camera details.

| File                                                                | What it is                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/capture/icon.png`                                           | 1024×1024 icon: the board brighter than Ton Up's (slate `#3D4955` / `#141920`, rings `#4F8A76` / `#A3624D`, numbers `#C3CCD5` on `#121820`) behind four viewfinder brackets, a reticle on the bull and three tip markers. |
| `assets/capture/splash.png`                                         | 1170×2532 launch art: the TON UP wordmark with a spaced teal CAPTURE line under the underline, and Ton Up's rising board in viewfinder brackets with a reticle on the bull and numbered tips 1, 2 and 3.                  |
| `assets/brand/capture-icon.svg`, `assets/brand/capture-splash.html` | Sources, from the Ton Up Icons & Launch artifact's "Capture app" row (teal accent). The PNGs were rendered in Chromium at 2× (icon) and 3× (splash) with JetBrains Mono Bold.                                             |

`app.config.ts` gives the capture variant its icon and the same `expo-splash-screen` settings with its own image; `pnpm capture:sync` picks them up.

After changing either, run `pnpm ios:sync` (prebuild) so the native project picks them up. The design canvas for these lives in the Ton Up Icons & Launch artifact (Icon D, Launch 3).
