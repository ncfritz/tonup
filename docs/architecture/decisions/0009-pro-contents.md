# 0009: Paid app; Ton Up Pro holds the extra games, drills, themes, analysis and camera scoring

- Status: Accepted (Pro price still open: $9.99 or $19.99)
- Date: 2026-11-02
- Amends: [0004](0004-pricing-and-pro.md) (settles the paid-vs-free question and Pro's contents)

## Context

ADR 0004 set a $9.99 app with a one-time Pro upgrade but left open whether the download is paid or free, and what Pro contains.

## Decision

1. **Paid download** at $9.99. No free tier.
2. **Ton Up Pro** is a one-time non-consumable in-app purchase at **$9.99 or $19.99** (to decide before App Store setup; product ID `app.tonup.pro`).
3. **Base app:** X01, Cricket (Standard, Cut-Throat), Around the Clock, Shanghai, Killer; pass-and-play and the five bot levels; tap and keypad input; Bob's 27, Count Up and the Around the Clock drill; averages, checkout %, history, replay and the board heatmap; rules for every game; the Pro theme in light and dark.
4. **Pro unlocks:**
   - every other game (the remaining 21 in [../../data/game-rules.md](../../data/game-rules.md));
   - every other practice mode: the full drill library, skill assessment, adaptive plan, checkout trainer;
   - the other four themes (Chalkboard, Arcade, Heritage, Training), light and dark;
   - analysis: aim-relative heatmap, drift and grouping, personal aim map, trends, ghost bot;
   - **camera scoring** when it ships (snap to score, then the fixed camera and linked display; ADR 0005).
5. **All of Pro ships in v1** except camera scoring, which arrives in later updates as part of Pro.

## Consequences

- Locked games, drills and themes are visible with a lock and lead to the Pro screen; rules pages for locked games stay readable, so players can see what they'd get.
- Buyers of Pro before the camera ships get it as a free update; the Pro screen and store text say camera scoring is "coming".
- v1 scope grows considerably (see the implementation plan); the base app is built and tested first.
- Theme gating needs a fallback: if Pro is refunded, the theme reverts to Pro (light or dark as set).
