# 0013: Lab pushes run progress to TU Capture through APNs

- Status: Accepted
- Date: 2026-11-08
- Builds on: [0001](0001-on-device-data.md), [0012](0012-capture-and-lab.md)

## Context

Training runs take an hour or more on the M1 Pro, and verification runs several minutes. Capture's Runs tab shows a run's progress, but only while it's open. A Live Activity on the Lock Screen and in the Dynamic Island would show the run going, and its result, without opening anything.

A Live Activity can be updated by the app itself, but iOS suspends Capture soon after it leaves the foreground, so a run that takes an hour would sit frozen most of the time. Only a push through Apple's push service (APNs) updates a Live Activity, or starts one, while the app isn't running. Lab can't reach the phone any other way: everything else between them is the phone calling Lab on the local network.

## Decision

1. **Lab sends Live Activity pushes through APNs** for TU Capture only. It authenticates with a token-signing key (`.p8`) from the Apple Developer account, configured in `lab/.env.local` (`TONUP_APNS_KEY`, `TONUP_APNS_KEY_ID`, `TONUP_APNS_TEAM_ID`; Lab's README); without it, Lab sends nothing.
2. **What leaves the network:** each push carries the run's title, stage, progress, estimated finish and its verified percentages, to Apple and from Apple to the phone. No photos, labels, captures or model files. The phone's tokens and theme colours go only to Lab, on the local network.
3. **Lab starts, updates and ends** the Live Activity: a push-to-start when a run starts (the phone sends Lab its push-to-start token whenever it's open), an update on each stage change and at most once a minute while it trains, and an end with the result.
4. **Ton Up is unchanged.** It has no push entitlement, no widget extension and none of the packages (`expo-widgets` and `@expo/ui` are excluded from its build); ADR 0001 still holds for it in full.

## Consequences

- An exception to ADR 0001 for the internal tools: Apple sees run progress for one internal app. Acceptable because the content is about model training, not anyone's games or photos.
- Capture needs the Push Notifications capability and an app group (`group.app.tonup.ios.capture`) for its widget extension; Xcode's automatic signing adds them.
- Builds installed from Xcode use the APNs sandbox (the default); a TestFlight build would need `TONUP_APNS_ENV=production`.
- When Lab is off or loses the network mid-run, the Live Activity goes stale after ten minutes (each push sets a stale date) and iOS removes it after its usual eight hours.
