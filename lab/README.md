# Ton Up Lab

The laptop web app for snap-to-score training data: captures from Ton Up Capture, train/val/verify splits, training and verification runs, and the model registry. Plan: [docs/plan/capture-lab.md](../docs/plan/capture-lab.md); decision: [ADR 0012](../docs/architecture/decisions/0012-capture-and-lab.md).

Next.js with Ant Design, SQLite through Drizzle (better-sqlite3). It is its own pnpm project, separate from the Expo app's hoisted `node_modules`, and imports the app's board geometry and scoring from `../src/domain`.

## Run

```sh
cd lab
pnpm install
pnpm dev          # http://127.0.0.1:3100, this Mac only
pnpm dev:lan      # also reachable from the phone at http://<this-mac>.local:3100
pnpm build && pnpm start      # or start:lan
```

Data lives in `~/TonUpLab/` (set `TONUP_LAB_DATA` to move it): `lab.db`, `photos/` and `thumbs/`, with snapshots, runs and models as the milestones land. The database is created and migrated on startup.

## Getting captures in

- **From TU Capture:** it uploads to `POST /api/captures` (multipart: `photo` and `label`, the JSON in docs/plan/capture-lab.md). Start Lab with a LAN script so the phone can reach it.
- **Ton Up's kept photos:** copy Files › On My iPhone › Ton Up › captures to the Mac and import the folder on the Sessions page (or `POST /api/import` with `{ "folder": "..." }`). Each day becomes a session.
- **DeepDarts:** set its folder on the Sessions page; Lab checks it and training reads it in place.

Every session gets its set (train, val or verify) the first time Lab sees it. The label editor saves each change as a new version; the review queue collects labels whose tips disagree with their values, darts flagged on the wire and board marks that don't fit.

macOS asks once whether Node may accept incoming connections when you first use a LAN script.

## Check

```sh
pnpm check        # typecheck, lint, tests
pnpm db:generate  # after changing src/lib/db/schema.ts
```

`GET /api/health` returns the version, data folder, session count, active model and a scoring self-check (a dart in the middle of the treble 20 must score T20).
