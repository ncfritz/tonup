# 0008: Link a display over the local network, joined by QR code

- Status: Proposed (for the fixed-camera release; not in v1)
- Date: 2026-10-29

## Context

With a phone on a stand by the board, players want the scoreboard at the throw line on an iPad or second iPhone. Options were Network framework, Wi-Fi Aware, Multipeer Connectivity, Bluetooth LE and Apple's online services (research/multi-device.md).

## Decision

- Use Network framework with Bonjour on the local network, encrypted with TLS (QUIC streams), behind a native module.
- The camera phone shows a QR code (service name, one-time session code, TLS certificate fingerprint) plus a 4-digit code; the display scans or types it and checks the fingerprint.
- The camera phone holds the dart event log; the display receives events and sends commands (corrections, undo, next player).
- Wi-Fi Aware is a later fallback for places with no Wi-Fi. Multipeer Connectivity is not used (deprecated in Xcode 27).

## Consequences

- Needs the local network permission and the Bonjour service type in Info.plist (via app.config).
- No server and no account (ADR 0001).
- The same link can later carry a second camera's detections.
