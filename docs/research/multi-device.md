# Multi-device play

Not in v1; it arrives with the fixed camera (ADR 0005, ADR 0008). Researched 2026-10-29.

Use Apple's Network framework with Bonjour discovery on the local network, joined by scanning a QR code; no server is needed. Bluetooth is too slow for camera previews, and Multipeer Connectivity is deprecated in Xcode 27 ([TN3213](https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework)). In the Expo app this is a native module.

## Device roles

| Mode | Camera | Display | Notes |
| --- | --- | --- | --- |
| Solo device | iPhone on a stand | Same iPhone | Large type and spoken scores, since the phone is away from the player |
| Camera + display | iPhone on a stand | iPad or second iPhone at the oche | Display shows the scoreboard and handles corrections |
| Camera + TV | iPhone on a stand | TV via AirPlay as an external screen | No second device needed; a later quick win |
| Two cameras | Two iPhones at different angles | Either, or a third device | Fuses both views to beat occlusion |
| Remote match | One camera at each board | Each player's own screen | Needs internet; Game Center or SharePlay can relay without our own server |

## Linking options

| Option | Needs | Fit |
| --- | --- | --- |
| Network framework + Bonjour (recommended) | Both devices on the same Wi-Fi, or Apple peer-to-peer Wi-Fi when opted in | Mature and fast enough for preview frames; QUIC with TLS gives encrypted streams |
| [Wi-Fi Aware](https://developer.apple.com/documentation/wifiaware/building-peer-to-peer-apps) | iOS 26+, a one-time pairing through the system device picker, an entitlement | Works with no router at all (a garage with no Wi-Fi); add as a fallback. Apple notes Wi-Fi Aware with QUIC isn't supported before iOS 27 |
| Multipeer Connectivity | — | Deprecated in Xcode 27; avoid |
| Bluetooth LE | Bluetooth on | Discovery and tiny score messages only; too slow for images. Useful for soft-tip electronic boards |
| Game Center / SharePlay | Internet, Apple Account | Remote matches later, not same-room play |

## Joining a game

1. The camera phone starts a session and advertises a Bonjour service, for example `_tonup._udp`.
2. It shows a QR code holding the service name, a one-time session code and a fingerprint of its TLS certificate, with a 4-digit code underneath for typing.
3. The display scans the code (in-app scanner, or the system camera through a universal link on tonup.app), finds the service, and connects with TLS, checking the fingerprint so it can't join the wrong board.
4. Devices that know each other reconnect automatically next time.

## What flows between devices

- The camera phone is the source of truth: it holds the dart event log (ADR 0006) and sends each new event as it happens.
- The display sends commands back: corrections, undo, next player, game setup.
- For corrections, the camera sends a small JPEG crop around each dart; nothing else of the video leaves the camera phone.
- If the link drops, the camera keeps scoring and the display catches up from the log when it reconnects.

The app needs the local network permission prompt (a usage description and the Bonjour service type declared in Info.plist, set through app.config).

## Open questions

- Whether the display can also be a Mac, which Network framework would allow.
