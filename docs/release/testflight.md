# TestFlight checklist

The M15 done-when: a TestFlight build with no known blockers. Builds are local (ADR 0010).

## Before the build

1. `pnpm install`, then `pnpm check` (types, lint, tests, contrast).
2. Run the Maestro flows on a simulator build: `pnpm ios`, then `pnpm e2e` (needs the Maestro CLI).
3. Bump `version` (marketing, for example 1.0.0) and `ios.buildNumber` in `app.config.ts`; the build number must go up for every upload.
4. `pnpm ios:sync` (prebuild) so the privacy manifest, icon and launch screen reach the Xcode project.
5. Accessibility pass on a phone (see below).

## App Store Connect

1. Create the app record for `app.tonup.ios` (if it isn't there), with the listing from [app-store.md](app-store.md).
2. Create the in-app purchase `app.tonup.pro` (non-consumable, $19.99, Family Sharing on) and submit it with the first build.
3. App Privacy: Data Not Collected ([privacy.md](privacy.md)).
4. Agreements, tax and banking must be active for paid apps and in-app purchases.

## Build and upload

1. Open `ios/TonUp.xcworkspace`, select Any iOS Device, Product › Archive.
2. In the Organizer: Validate, then Distribute App › App Store Connect › Upload.
3. Generate the privacy report from the archive and check it against [privacy.md](privacy.md).
4. In TestFlight, add internal testers; external testing needs Beta App Review.

## Test in TestFlight

- Buy Pro in the sandbox (TestFlight purchases are free), delete and reinstall, Restore.
- Every screen in all ten themes.
- A backup exported on one phone and imported on another.
- Report a problem sends through Mail.

## Accessibility pass

- VoiceOver: New game, a 501 leg on the keypad (it opens on the keypad with VoiceOver on), the scoreboard rows and checkout strip are read, the summary, a drill with Hit and Miss, Rules search.
- Dynamic Type at the largest accessibility size: body text grows up to double and display text less; check the scoreboard, keypad, Practice rows and Settings for clipping.
- Reduce Motion and Bold Text on.
