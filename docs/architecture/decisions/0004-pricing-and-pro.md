# 0004: $9.99 app with a one-time Ton Up Pro upgrade

- Status: Accepted (price); the paid-download vs free-with-unlock question is open
- Date: 2026-10-29

## Context

Competitors with camera scoring sell subscriptions (Dartsmind $14.99/year, Autodarts Plus £59.99/year, DartCounter Ultimate $39.99/year), and users push back on them; one Dartsmind reviewer said they'd rather pay about $10 once (research/competitors.md). A one-time price is a clear differentiator.

## Decision

1. **Price:** $9.99 to buy, plus **Ton Up Pro**, a $9.99 one-time non-consumable in-app purchase. No subscription, no ads, no account.
2. **Split** (a proposal, to confirm in the implementation plan): anything you need to play a normal game is in the base app; anything that analyses or coaches is Pro.

| Area | Base | Pro |
| --- | --- | --- |
| Games | X01, Cricket (Standard, Cut-Throat), Around the Clock, Shanghai, Killer | Remaining cricket variants, party and sports games as they ship |
| Opponents | Pass-and-play up to 6 players; Gaussian bot, 5 levels | Ghost bot fitted to your own throws |
| Input | Tap-on-board and keypad | Same |
| Training | Bob's 27, Count Up, Around the Clock | Full drill library, assessment, adaptive plan |
| Stats | Averages, checkout %, history, replay, board heatmap | Aim-relative heatmap, drift and grouping, personal aim map, trends |
| Knowledge | Rules for every included game, checkout routes | Checkout trainer |

3. StoreKit 2 behind a purchases service, as in Tippytoe's ADR 0021: ownership is StoreKit's verified entitlements on the device; no receipt server or third-party purchase service. Restore Purchases on the Pro screen and in Settings. Family Sharing on Pro (optional). Pro features are gated in one place so locked items are visible and lead to the Pro screen.

## Consequences

- Under Apple's Small Business Program (15% commission under $1M a year in proceeds) each sale nets about $8.49 ([Adapty](https://adapty.io/blog/app-store-small-business-program/)). Enrolment takes effect from the month after approval, so enrol before launch.
- Selling needs the Paid Apps Agreement, banking and tax in App Store Connect; the seller name is the account holder's (individual vs LLC is still open).

## Open questions

- **Paid download vs free with unlock:** a free download with X01 and a couple of drills, then $9.99 to unlock the full app and $9.99 for Pro, earns the same per buyer and lets players try before paying. Switching a paid app to free later is awkward for existing buyers, so decide before launch.
- Does camera scoring arrive as a free update for existing buyers or as part of Pro?
