# Competitors

Researched 2026-10-29. Phone-camera auto-scoring already exists on iOS, so camera scoring alone is table stakes, not a moat. The market splits into three tiers: manual scorers (free to about $2), app plus phone-camera scoring (subscription), and dedicated multi-camera hardware ($500–$1,800+).

| Product | Scoring method | Games and training | Pricing | Notable gaps |
| --- | --- | --- | --- | --- |
| [Dartsmind](https://apps.apple.com/app/id1018594473) | Rear phone camera, on-device AI, any angle; optional two-device dual camera; A12 chip or newer | X01, 5 cricket variants, about 12 practice games (JDC, Catch 40, 121, Bob's 27), party games, DartBot, online video play | [Pro $5.49/quarter or $14.99/year](https://apps.apple.com/py/app/dartsmind/id1018594473?l=en-GB), plus coin packs | Users push back on the subscription; strongest direct competitor |
| [Autodarts (Winmau)](https://winmau.com/pages/autodarts-x-faqs) | Manual, "Lens" phone camera (capped free allowance), or the Autodarts X four-camera ring (£449.99) | X01, Cricket, Count Up, Random Checkout, Segment Training, Around the World, Bob's 27, bot, matchmaking, tournaments | Free core; Plus £59.99/year for unlimited Lens and deeper stats | Autodarts X needs the online platform; no offline mode at launch |
| [DartCounter (Target)](https://apps.apple.com/app/id999533915) | Manual; Target Omni four-camera ring over Wi-Fi | X01, Cricket, Around the Clock, Shanghai, 121, singles/doubles/score training; MasterCaller voice | [Ultimate $5.99/month or $39.99/year](https://mwm.ai/>/apps/dartcounter/999533915) | Largest user base; [Omni needs internet](https://dartcounter.net/darts-manual/omni-auto-scoring); no phone-camera scoring |
| [Scolia](https://scoliadarts.com/compare/) | Dedicated three-camera hardware, about 99.8% accuracy (Pro) | Web app: matches, training, tournaments, heatmaps | Home about €545–905, Pro €1,690 | Expensive; hardware install |
| [DartsAI](https://apps.apple.com/bf/app/dartsai/id6746346359) | Phone camera | X01 variants, online lobby (4 players), local tournaments | Free | Thin game and training catalog |
| [All-Round Darts Academy](https://apps.apple.com/us/app/-/id6739191378) | Manual | Structured academy programs: technique, tactics, mentality | $7.99–9.99/month or $49.99/year | No camera; premium price |
| [DARTS Scorekeeper 2026](https://apps.apple.com/app/id1504732492) | Manual, tap on a virtual board | X01, Cricket, 8 party games, 5 bot levels | Free + in-app purchases | Tap-to-board input is its hook |

**Patterns worth copying:** tap-on-board input (gives dart positions without a camera), checkout suggestions, bots with tiers, an easy correction flow after a missed detection, heatmaps.

## Gaps to exploit

- **Offline and private.** Autodarts X and Omni depend on a cloud connection; Dartsmind is on-device but subscription-gated.
- **Pricing.** A Dartsmind reviewer said they'd pay a one-time ~$10 instead of subscribing. Ton Up is a one-time purchase (ADR 0004).
- **Coaching, not just drills.** Most apps list practice games; few connect a weakness in your stats to a specific drill and track progress over weeks.
- **Rules and knowledge** are an afterthought everywhere (a short in-app guide at best).

## Differentiators

| Theme | What Ton Up does | Who lacks it |
| --- | --- | --- |
| Positions everywhere | Every dart stored with a board position (tap or camera) to power heatmaps, drift and grouping | Keypad scorers; DartCounter's throw map needs Omni hardware |
| Coaching loop | Assessment → weakness → drill → trend, re-tested monthly | Most apps; All-Round does it without a camera at $49.99/year |
| Human-like and ghost bots | Gaussian bots tuned to an average, plus a bot fitted to your own throws | Bots elsewhere are level presets |
| Offline and private | No account, no server, on-device inference | Autodarts X and Omni need a connection |
| Fair pricing | $9.99 app plus a one-time $9.99 Pro upgrade | Dartsmind, Autodarts, DartCounter are subscriptions |
| Learn → Play | Rules and checkout lessons that launch the game or drill | Rules are a help page elsewhere |
