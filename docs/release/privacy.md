# Privacy

Ton Up collects nothing (ADR 0001). There are no accounts, servers, analytics, ads or crash reporting, and the app makes no network requests of its own. The only thing that touches the network is the App Store, through StoreKit, when you buy or restore Ton Up Pro.

## App Store privacy label

In App Store Connect › App Privacy:

- **Data collection:** "No, we do not collect data from this app."
- That gives the label **Data Not Collected**.

That holds because:

- games, darts, drills, settings and the diagnostics log stay in the app's SQLite database on the phone;
- backups, CSV exports and problem reports leave only when you send them yourself through the share sheet, to wherever you choose (Apple's definition of collection excludes data the user sends this way);
- purchases go through Apple; the app only asks StoreKit whether Pro is owned.

## Privacy manifest

`app.config.ts` › `ios.privacyManifests` writes `PrivacyInfo.xcprivacy` at prebuild:

| Key                           | Value                                                                                                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `NSPrivacyTracking`           | false                                                                                                                                   |
| `NSPrivacyTrackingDomains`    | none                                                                                                                                    |
| `NSPrivacyCollectedDataTypes` | none                                                                                                                                    |
| `NSPrivacyAccessedAPITypes`   | UserDefaults (CA92.1), file timestamps (C617.1), system boot time (35F9.1), disk space (E174.1): what React Native, Expo and SQLite use |

Before each release, check Xcode's privacy report (Product › Archive, then Generate Privacy Report in the Organizer) for a required-reason API that a new dependency adds.

## Privacy policy

App Store Connect needs a privacy policy URL even for an app that collects nothing. Suggested text for `https://tonup.app/privacy`:

> Ton Up doesn't collect any data. Your games, practice and settings are stored only on your iPhone. The app has no accounts, analytics, advertising or tracking, and it doesn't send anything over the internet. Purchases of Ton Up Pro are handled by Apple. If you export a backup or send a problem report, it goes only where you send it. Questions: support@tonup.app.

## Report a problem

Settings › Report a problem builds a plain-text report the user previews and sends through the share sheet (`src/features/diagnostics/report.ts`). It holds the app and iOS versions, settings, whether Pro is owned, how many sessions and darts are stored, the user's description, and the local diagnostics log (errors, purchase and backup results). It never includes player names or game data.

## Camera

Snap to score (ADR 0011) uses the camera with permission ("Ton Up uses the camera to read your darts from a photo of the board. Photos stay on your iPhone."); no microphone. Photos are read on the phone by the bundled model and discarded, unless the player turns on Settings › Camera › Keep photos to improve detection, which keeps them and their labels in the app's Documents folder (visible in the Files app). Nothing is uploaded, so the App Store label stays Data Not Collected.
