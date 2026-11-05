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

Data lives in `~/TonUpLab/` (set `TONUP_LAB_DATA` to move it): `lab.db`, `photos/` and `thumbs/`, `snapshots/` (what each run trained on), `runs/<id>/` (log, metrics, checkpoint, verification) and `models/<vN>/` (the Core ML package). The database is created and migrated on startup.

## Light and dark

Lab follows the system's light or dark setting. The moon or sun at the right of the header picks Light, Dark or Match the system for this browser (`components/colorMode.ts`; a small script in `app/layout.tsx` sets it before the page paints, so a dark page doesn't flash white). Colours come from Ant Design's tokens (`var(--ant-…)` in the CSS modules, `useChartTheme` for the charts), so new screens follow without extra work; the header stays navy in both.

## Getting captures in

- **From TU Capture:** it uploads to `POST /api/captures` (multipart: `photo` and `label`, the JSON in docs/plan/capture-lab.md). Start Lab with a LAN script so the phone can reach it.
- **Ton Up's kept photos:** copy Files › On My iPhone › Ton Up › captures to the Mac and import the folder on the Sessions page (or `POST /api/import` with `{ "folder": "..." }`). Each day becomes a session.
- **DeepDarts:** set its folder on the Sessions page; Lab checks it and training reads it in place.

Every session gets its set (train, val or verify) the first time Lab sees it. A capture can be deleted from its label editor and a whole session from the Sessions page: the photos, labels and measurements go, while past runs keep their snapshots and verification results. The label editor saves each change as a new version; the review queue collects labels whose tips disagree with their values, darts flagged on the wire and board marks that don't fit.

macOS asks once whether Node may accept incoming connections when you first use a LAN script.

## Training

Runs › New run snapshots the labels, trains with `ml/` (`../ml/.venv/bin/python`, or `TONUP_LAB_PYTHON`), verifies on the verify set and exports; the result is a candidate on Models. Verification (or Models › Compare) checks chosen models on one fresh snapshot of the verify set, with the breakdown by condition and the worst photos; download a model's Core ML package from Models. Runs go one at a time; use `pnpm start` rather than `pnpm dev` for long runs, since hot reload restarts the server.

## Model pull and review

Capture pulls the active model from `GET /api/models/active` (Settings › Get vN from Lab). Labels pre-filled by a model carry what it placed; Lab measures what the player kept, queues corrected labels first in To review (Looks right clears one), and charts acceptance per model on Overview.

## Check

```sh
pnpm check        # typecheck, lint, tests
pnpm db:generate  # after changing src/lib/db/schema.ts
```

`GET /api/health` returns the version, data folder, session count, active model and a scoring self-check (a dart in the middle of the treble 20 must score T20).
