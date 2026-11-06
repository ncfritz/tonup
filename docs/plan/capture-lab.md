# Capture and Lab: implementation plan

- Status: Built (2026-11-04): L0 to L5 done. Still to try on real hardware: Capture on the iPhone (L2, L5) and a DeepDarts baseline on the M1 Pro (L3)
- Decisions: [ADR 0012](../architecture/decisions/0012-capture-and-lab.md); builds on [snap-to-score.md](snap-to-score.md) (milestone S4)

Ton Up Capture is an internal iPhone app for photographing visits and labelling them carefully. Ton Up Lab is a web app on the laptop that collects the captures, keeps the training and verification sets apart, runs training and verification, and manages models. Together they turn "copy a folder and run a script" into a loop: capture, label, train, verify, pull the new model into Capture to pre-fill the next labels.

## Overview

```
iPhone: Ton Up Capture                    M1 Pro laptop: Ton Up Lab (lab/, Next.js + AntD)
  session → snap → values → board → tips    ├─ SQLite (lab.db): sessions, captures, labels, runs, models
  outbox (Documents/outbox) ── HTTP ──────▶ ├─ files (~/TonUpLab): photos, snapshots, runs, models
  active model ◀──────────── HTTP ───────── └─ runner: ml/.venv python -m tonup_ml.* (MPS), one job at a time
```

## Ton Up Capture (phone)

### Build

- `app.config.ts` reads `APP_VARIANT`. For `capture` it changes the name ("TU Capture"), icon, bundle ID (`app.tonup.ios.capture`), scheme (`tonupcapture`) and expo-router's routes directory (`src/capture-app`), drops the StoreKit and IAP plugins, and adds:
  - `NSLocalNetworkUsageDescription` ("Sends photos and labels to Ton Up Lab on your Mac.")
  - `NSAppTransportSecurity.NSAllowsLocalNetworking` (plain HTTP to `.local` names and local addresses only)
- Scripts: `capture:sync` (`APP_VARIANT=capture expo prebuild --platform ios --clean`) and `capture:ios`. Switching back to Ton Up is `ios:sync`. Every `ios`/`capture` run script first checks that `ios/` was generated for its variant and, if not, regenerates it (`scripts/stale-workspaces.mjs`), so `ios:release` after `capture:sync` builds Ton Up, not TU Capture.
- Ton Up's bundle only includes routes under `src/app`, so nothing from `src/capture-app` or `src/features/capture-lab` ships in it. A test asserts that no Ton Up route imports from `features/capture-lab`.

### Screens (`src/capture-app`, logic in `src/features/capture-lab`)

| Screen         | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tabs           | Ton Up's tab bar: Overview and Models, **Sessions** in the middle as the board button (home), Runs and Settings. The camera and labelling screens are full screen, without it. Every screen shows Lab's state in a pill (Lab, Lab offline, Lab…, No Lab; a tap checks again), from one check shared by the app every 30 s and on returning to it                                                                                                                                                                                                                                                                                                                                     |
| Sessions       | Home. A line with Lab's status, its active model, the outbox and Sync; the session being shot (filled with `accentSoft`) with its labelled / values only / to label bar and counts, Keep snapping and Label N, or a New session card with the condition tags; totals; past sessions with their set and counts, and Label all                                                                                                                                                                                                                                                                                                                                                         |
| Session photos | One session's photos in a grid (under the Sessions tab, with the bar), each marked with its total (labelled), V and its total (values only) or To label; a count strip filters them. Tapping one to label, or Label N, starts labelling there; a values-only one opens to add its tips; a labelled one opens the saved visit (its board and tips drawn, total, sent or waiting)                                                                                                                                                                                                                                                                                                      |
| Session        | Start a session with optional tags (board light on or off, standing left, centre or right, notes); snap loop with a square viewfinder the width of the screen: the photo kept is that square (`square.ts`), so the board fills the labelling screens and the model's square input isn't squeezed; the header counts what's saved and still to label, and the last photo's thumbnail (with the to-label count) opens the session's photos                                                                                                                                                                                                                                             |
| Values         | Keypad (reusing `@/ui` Keypad) for up to three darts at its own height: segment and ring, then the bulls, Miss, Bounce-out and Undo right under the numbers; at the bottom, full width, **Label later**, **Save values only** (the scores now, the board and tips later, on the phone or in Lab; also on the board step) and Next                                                                                                                                                                                                                                                                                                                                                    |
| Board          | The four calibration points and the bull: pre-filled by the active model when there is one, otherwise tapped by hand with the existing diagram and magnifier (`PhotoMarkup`), on the photo edge to edge and zoomable (pinch, or the + and − buttons; `ZoomPan`)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Tips           | Tap each dart tip in order on the zoomable photo; the darts sit in a row of chips under it. Each tap shows the value it scores; one that doesn't match its entered value turns red until it's moved or marked "on the wire" (kept, flagged for review)                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Review         | Rings drawn over the photo, numbered darts, entered and scored values; Save, Retake, or Save values only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Overview       | Lab's Overview (`GET /api/overview`): the active model against each bar, captures and the train / val / verify split, accuracy by model, coverage by condition with the thin ones called out, pre-fill kept                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Models         | Lab's models (`GET /api/models`): each one's three numbers against the bars, on this phone or not, kept as placed; a banner when a candidate beats the active model; Set active, Verify, and tick two to compare on the verify set                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Runs           | Lab's runs (`GET /api/runs`): the one going now (filled) with its epoch, time left, best visit and accuracy chart, updated every 3 s, and Cancel; earlier runs with what they made; **Fine-tune vN** (the active model, Lab's usual fine-tune settings) when nothing is running; tapping an earlier run opens it (under Runs, with the bar): what it made (Set active, Compare with the model it started from), its check against the bars and against that model (on the same photos when a verification measured both there, else that model's latest), accuracy and loss by epoch with the kept epoch marked, time, settings and the log (`GET /api/runs/:id`, with `comparison`) |
| Settings       | Lab address (default `http://<laptop>.local:3100`), Pull model, Appearance (any of Ton Up's themes, light, dark or system; Training dark until changed), clear sent photos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Every step fits the screen without scrolling: a compact top bar with the step (1 of 4 to 4 of 4), the step's content, and its buttons pinned at the bottom.

Rules:

- A capture is saved when every entered dart on the board has a matching tip (or an on-wire flag). Miss and Bounce-out need no tip.
- "Save values only" keeps the photo and values without tips; Lab uses these for visit-level verification only.
- Highlights are fills, not outlines: the session being shot, a live run and a model ticked to compare use `accentSoft`.
- The model only proposes; the player always confirms. The label records which model pre-filled it, so Lab can measure how often labels were corrected.

### Label later

**Label later** on the values step keeps the photo unlabelled and goes straight back to the camera, for when there's no time to label between visits. The photo waits in `Documents/drafts/<id>.jpg` and `.json` (its session, the time it was taken, its size), and goes to Lab at the next sync as a photo to label there (`syncDrafts`: the label file with no points or darts and `unlabelled: true`). Lab files it with status `unlabelled` and the review reason "not labelled", so it leads the To review queue and stays out of snapshots and the split counts until it's labelled in the editor. Each sync asks Lab after the drafts it has (`POST /api/captures/states`); one labelled there counts as labelled on the phone, shows "✓ Lab" and leaves the queue to label here. Labelling a draft on the phone instead still works: Lab takes that label as the photo's next version (Lab's own label, if it got there first, stays). Sessions and their photos count each photo as labelled, values only or to label (`sessionsOn`, `sessionPhotos`).

Labelling drafts (Label N on a session, Label all on Home for every session but the one being shot, or tapping a photo) runs through them oldest first (`queue.ts`, `labelQueue`): the same four steps under a bar with "Photo k of N to label", the progress and **Skip**. The model's pre-fill is read afresh (the phone may have a newer model by then). Saving puts the visit in the outbox under the draft's own ID and time and deletes the draft; **Save, next photo** and **Values only, next** move on, and after the last one the same screen says how many were labelled, values only and skipped (Back to the camera while a session is going, or Done). Values-only photos aren't to label: they've been decided. The camera's "Saved to label later" note has **Undo** for a few seconds.

A values-only visit can still get its tips: opened from its session's photos, it starts on its values with its board, and saving sends it again under its own ID. Lab keeps that as the visit's next label version (from the phone) and it becomes labelled; anything else sent again is ignored, as before.

### Outbox and upload

- No database: a saved capture is `Documents/outbox/<id>.jpg` and `<id>.json`. Upload moves them to `Documents/sent/` (kept until cleared from Settings). A cleared photo still shows: Lab's copy (`/api/captures/:id/photo` and `/thumb`) when Lab is up and has it, else its board, points and tips drawn from the label on a blank, with a line saying which.
- Sync runs on save, on opening Home, and from the button; failures stay in the outbox. Uploads are idempotent by capture ID.
- The label JSON is the existing capture format (`src/domain/camera/labels.ts`) with Capture's additions. Lab parses it in `lab/src/lib/labels.ts`:

  ```json
  {
    "id": "cap-0001",
    "image": "cap-0001.jpg",
    "width": 4032,
    "height": 3024,
    "createdAt": "2026-11-04T05:10:00.000Z",
    "sessionId": "sess-20261103-2102",
    "sessionStartedAt": "2026-11-04T05:02:00.000Z",
    "tags": ["light on", "left"],
    "calibration": [
      { "x": 0.48, "y": 0.06 },
      null,
      { "x": 0.52, "y": 0.94 },
      { "x": 0.17, "y": 0.55 },
      { "x": 0.5, "y": 0.5 }
    ],
    "darts": [
      { "x": 0.5, "y": 0.27, "value": "T20" },
      { "x": 0.45, "y": 0.2, "value": "5", "onWire": true },
      { "x": null, "y": null, "value": "Miss" }
    ],
    "valuesOnly": false,
    "prefillModel": "v3",
    "prefill": {
      "calibration": [
        { "x": 0.48, "y": 0.06 },
        null,
        { "x": 0.52, "y": 0.94 },
        { "x": 0.17, "y": 0.55 },
        { "x": 0.5, "y": 0.5 }
      ],
      "tips": [{ "x": 0.5, "y": 0.27 }, { "x": 0.41, "y": 0.21 }, null]
    },
    "zoom": 1,
    "deviceModel": "iPhone 16 Pro"
  }
  ```

  `calibration` is in DeepDarts order (5/20, 13/6, 17/3, 8/11, then the bull), null where a point isn't visible. Each dart is one thrown dart in order; a Miss or Bounce-out has no tip. `prefill` is what the model placed before the player confirmed (same order; here the player moved the second tip), sent whenever the model proposed a board. Ton Up's own files have plain `{x, y}` darts and no session, and Lab groups them into one session per day (`tonup-YYYY-MM-DD`).

### Model pull

`GET /api/models/active` returns the model's version and the files of its `.mlpackage` (a handful: `Manifest.json`, the model spec and the weights). Capture downloads them into its `models` folder with `expo-file-system`, where `dart-vision` already looks and compiles them on load. No archive format; the one native addition is `reloadModelAsync`, so a new model is used without restarting the app.

## Ton Up Lab (laptop)

### Stack

| Piece    | Choice                                                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project  | `lab/`: its own pnpm project and lockfile (the app uses `node-linker=hoisted`, and Next.js and React Native shouldn't share hoisted packages); excluded from the app's tsconfig, ESLint, Jest and Metro |
| Web      | Next.js (App Router, Node runtime) with Ant Design (its own default and dark themes); API as route handlers                                                                                             |
| Data     | SQLite (`better-sqlite3`) through Drizzle, migrations with drizzle-kit, as the app does                                                                                                                 |
| Files    | `~/TonUpLab/` (set by `TONUP_LAB_DATA`), outside the repo and covered by Time Machine                                                                                                                   |
| Shared   | Geometry and scoring imported from `../src/domain` (plain TypeScript), so Lab checks labels exactly as the phone does                                                                                   |
| Training | Child processes of `ml/.venv/bin/python -m tonup_ml.*`, wrapped in `caffeinate -i` so the laptop doesn't sleep mid-run                                                                                  |
| Serving  | `pnpm start` listens on `127.0.0.1:3100`; `pnpm start:lan` on `0.0.0.0:3100` for capture sessions. macOS asks once to allow incoming connections                                                        |

### Data

Files:

```
~/TonUpLab/
  lab.db
  photos/<captureId>.jpg
  deepdarts/                     DeepDarts download (or a symlink to ml/data/deepdarts)
  snapshots/<snapshotId>/        hard links to photos + label JSON at that version + manifest.json
  runs/<runId>/                  args.json, log.txt, metrics.jsonl, best.pt, best.json, eval.json, predictions.jsonl
  models/<modelId>/              DartKeypoints.mlpackage, card.json
```

Tables (columns, no JSON blobs except run parameters):

| Table          | Holds                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessions`     | id, started, device, split, tags                                                                                                                      |
| `captures`     | id, session, photo, size, taken, zoom, device model, status (labelled, values only, rejected), prefill model                                          |
| `labels`       | id, capture, version, created, source (phone or Lab)                                                                                                  |
| `label_points` | label, kind (cal20, cal6, cal3, cal11, bull), x, y                                                                                                    |
| `label_darts`  | label, index, entered value, x, y (null for Miss, Bounce-out or values only), on-wire flag, scored value                                              |
| `conditions`   | capture: camera angle and distance (from the homography and the board's size in pixels), brightness, dart count, grouping                             |
| `snapshots`    | id, created, counts per split, path                                                                                                                   |
| `runs`         | id, kind (train, verify), status (queued, running, done, failed, cancelled), parameters, snapshot, base model, pid, times, exit code, summary metrics |
| `models`       | id, run, name, created, status (candidate, active, retired), path                                                                                     |
| `verify_items` | run, capture, board found, darts correct, visit correct, predicted points                                                                             |

### Splits

- A session's split is chosen when Lab first sees it: a hash of the session ID into train 80%, val 10%, test 10%. It's stored and never changes, so adding data never moves a photo between sets.
- Val chooses the best checkpoint during training. Test is the verification set: only verification runs read it.
- Imported folders (Ton Up's own "Keep photos" captures) become one session per day, split the same way.
- DeepDarts keeps its own split by folder, as in `ml/`.

### Pages

| Page     | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview | Counts by split and status, coverage by condition (angle, distance, brightness, dart count) with the thin buckets highlighted                                                                                                                                                                                                                                                                                                                                                                                    |
| Captures | Gallery with label overlays, filtered by session, split, status, condition and flags; flagged and corrected-from-model first in "To review"                                                                                                                                                                                                                                                                                                                                                                      |
| Capture  | Fills the window without scrolling under its title bar: the photo fitted to the space (full width when that leaves room, else full height; wheel to zoom, drag to pan) with rings drawn through the homography; the darts beside it (values, tip scores, wire, **Add dart**, save); board points, photo details and label history in Olympus-style collapsible side tabs (`SideTabs`, open or closed remembered per browser; under 1440 px the open panel lies over the darts). Each save is a new label version |
| Sessions | Sessions with split, tags and counts; import a captures folder                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Runs     | Start a training run (baseline, or fine-tune from a model; epochs, learning rate, DeepDarts sample) or a verification run; queue; cancel                                                                                                                                                                                                                                                                                                                                                                         |
| Run      | Live log and per-epoch charts from `metrics.jsonl`; on finish, the model it produced                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Models   | Registry with verification numbers against the bar; set active (what Capture pulls); compare two; download the `.mlpackage`                                                                                                                                                                                                                                                                                                                                                                                      |
| Verify   | One verification run: totals against the bar, breakdown by condition, and a gallery of the worst photos with predicted and true points                                                                                                                                                                                                                                                                                                                                                                           |

### Runs

- One job at a time from a queue in `runs`. The runner lives in the Next.js server process (a singleton on `globalThis`, started from `instrumentation.ts`); on startup it marks any run left "running" as failed.
- A training run:
  1. snapshots the current train and val captures
  2. trains (`tonup_ml.train`)
  3. evaluates the best checkpoint on the test split
  4. exports to Core ML
  5. registers the model as a candidate
- A verification run evaluates chosen models on a fresh snapshot of the test split. The test split grows over time, so Compare re-verifies both models on the same snapshot rather than comparing old numbers.
- Logs stream to the Run page by polling `log.txt` and `metrics.jsonl`.

### API used by Capture

| Route                                | What                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                    | Lab version and the active model's version                                                                                                                                                                                                                             |
| `GET /api/sessions`                  | The session IDs Lab has: Capture marks its own sessions that aren't on Lab yet (waiting to send or to be labelled) or were deleted there, and can remove a deleted one's sent photos                                                                                   |
| `POST /api/captures/states`          | `{ ids }` → each capture's status: Capture asks after the Label later photos it sent, to count those labelled in Lab                                                                                                                                                   |
| `GET /api/runs/:id/verification`     | A verification as Lab's Verification page has it (each model's numbers, by condition, the worst photos), for Capture's verify run screen: the verdict and Set active, scores side by side against their bars, by condition, and the worst photos over Lab's thumbnails |
| `POST /api/captures`                 | Multipart: the photo and its label JSON; idempotent by ID                                                                                                                                                                                                              |
| `GET /api/models/active`             | Version and file list of the active model                                                                                                                                                                                                                              |
| `GET /api/models/:id/files/...`      | One file of a model package                                                                                                                                                                                                                                            |
| `GET /api/overview`                  | Overview tab: counts, active model, progress, coverage, pre-fill (`lib/phone.ts`)                                                                                                                                                                                      |
| `GET /api/models`                    | Models tab: every model's numbers, pre-fill kept, verify photos                                                                                                                                                                                                        |
| `POST /api/models/:id/activate`      | Set active (Models tab)                                                                                                                                                                                                                                                |
| `GET /api/runs`, `GET /api/runs/:id` | Runs tab: the list, and a live run's epochs and step                                                                                                                                                                                                                   |
| `POST /api/runs` (`kind: verify`)    | Verify or compare models (Models tab)                                                                                                                                                                                                                                  |
| `POST /api/runs/:id/cancel`          | Cancel the live run (Runs tab)                                                                                                                                                                                                                                         |

## Changes to `ml/`

- `train.py`:
  - `--metrics <file>` writes one JSON line per epoch (loss, visit correct, segment correct, board found, time)
  - `--deepdarts-sample N` draws N DeepDarts photos per epoch, so fine-tunes aren't dominated by the 16k
- `data.py`: captures use `sessionId` as the group and `split` from the label when present; values-only captures are skipped for training.
- `evaluate.py`: `--out` writes the totals as JSON and `--predictions` writes one line per photo; values-only captures count for visit correct only.
- Tests for each in `ml/tests`.

## Milestones

| #   | Delivers                                                                                                                                       | Done when                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| L0  | `APP_VARIANT` config and scripts, an empty Capture app, `lab/` skeleton (Next.js, AntD, Drizzle, SQLite) importing `../src/domain`, exclusions | Both iOS variants build; Ton Up's bundle has no capture code; Lab starts and scores a test dart |
| L1  | Lab data: schema, `POST /api/captures`, splits, conditions, folder import, DeepDarts import, Captures and Capture pages (view and edit labels) | A captures folder from Ton Up imports, gets splits, and shows with overlays                     |
| L2  | Capture: sessions, snap, values, board, tips with the match check, review, outbox and sync                                                     | A session on the phone uploads to Lab with every tip matching its entered value                 |
| L3  | `ml/` changes; runner, Runs and Run pages; snapshots; models registered from training runs                                                     | A DeepDarts baseline started from Lab finishes on the M1 Pro and registers a candidate          |
| L4  | Verification runs, Verify page, Models page (active, compare, download), Overview coverage                                                     | Two models compared on one test snapshot, with the breakdown by condition                       |
| L5  | Model pull into Capture and pre-filling; "To review" queue of flagged and corrected labels                                                     | A labelled visit is mostly confirming what the model placed                                     |

Before L3, time a short run on the M1 Pro (`--limit 2000 --epochs 1`) to set the default epochs and DeepDarts sample.

## Shipping a model in Ton Up

Not automated: copy the chosen model's `DartKeypoints.mlpackage` into `modules/dart-vision/ios/Models`, add the DeepDarts credit to the acknowledgements, and build. The bar is in [snap-to-score.md](snap-to-score.md#accuracy-bar), measured by a Lab verification run.

## Built so far

- **L1 (Lab data):** the schema above; `POST /api/captures` (multipart `photo` + `label`, idempotent by ID); photos stored upright (EXIF orientation applied, since training's PIL ignores it) with thumbnails; each label measured on save (tip scores through the shared geometry, camera angle and board size from the board outline, brightness, tight groups); review reasons: board not marked, board marks disagree (fit residual over 8 mm), value mismatch, on the wire. Pages: Overview (counts, a side panel with coverage by condition as Captures has it, each measure across the models against its ship bar, labelled photos per week by set, a camera angle by light heatmap, pre-fill kept, coverage by condition); a training run (the accuracy and loss charts with the settings in a narrow column beside them, then the epochs a row each: training loss, visits, darts, board and val loss as small bars, and the time as HH:MM:SS; the running epoch as one bar of its steps); a verification (a row of charts per measure, a chart per condition, and the worst photos a strip per model as Captures shows sessions); Models (accuracy by model beside active vs candidate: the active model and the newest candidate by condition from the latest verification that ran both); Captures gallery (by date, or a row per session; session and status filters; a side panel with the sets and review queue as a list with counts, coverage by condition, and where the shown darts landed as a board heatmap and a row per number, 1–20, 25, Bull and Miss, its singles, doubles and trebles stacked in one bar), the label editor (drag points and tips, edit values and flags, rings drawn through the fit, versions, leave out of training) and Sessions (import a folder, the DeepDarts folder).

- **L2 (Capture):** `src/capture-app` (Home, Session, Label, Settings) over `src/features/capture-lab`: the visit as plain state (`visit.ts`: values, board, tips, review; a tip must score its value or be flagged on the wire), the label file, the outbox as files in Documents (`outboxFiles.ts`), sync (`outbox.ts`, `lab.ts`: multipart upload with `expo-file-system`'s `File.upload`) and the settings and session store (`store.ts`, saved to Documents/capture-state.json). The photo markup from snap to score (`PhotoMarkup`) now takes plain props so both apps use it. An installed model pre-fills the board and matches its tips to the values entered.

- **L3 (training from Lab):** `snapshots`, `runs` and `models` tables. A training run snapshots the current labels (`snapshots/<id>/`: each photo hard-linked beside a label file in `ml/`'s format with its split, plus `manifest.json`), then runs `tonup_ml.train` (epoch metrics to `metrics.jsonl`), `tonup_ml.evaluate` on the snapshot's verify photos (DeepDarts' test split until there are any) and `tonup_ml.export`, and registers the best checkpoint as a candidate model `vN`; a failed export still registers it, without a Core ML package. One run at a time from a queue (`src/lib/runner.ts`), under `caffeinate -i` on macOS; cancel kills the process group, and a run left running when Lab stopped is marked failed on startup. Pages: Runs (list, new-run drawer: from scratch or fine-tune a model, data, epochs, learning rate, batch, capture weight, DeepDarts sample per epoch), Run (live progress with step, elapsed, estimate, throughput; accuracy and loss by epoch against the bar; settings; log; verified results) and Models (scores against the bar, Core ML path, set active). `ml/` gained `--metrics`, `--deepdarts-sample`, `--seed`, `--no-pretrained` and step progress in `train`, `--out` and `--predictions` in `evaluate`, and reads Lab snapshots (split from the label, values-only visits skipped).

- **L4 (verification):** `verify_results` (a model's totals in one verification) and `verify_items` (each photo's outcome, the model's points, and the photo's conditions as of the snapshot). A verification run (`POST /api/runs` with `kind: "verify"` and up to four `modelIds`) takes one fresh snapshot and evaluates each model on its verify photos; a training run records its own check the same way, and each model's numbers become those of its latest verification. Values-only visits now count: `evaluate` judges them on the visit total and the segments from the entered values (`--captures` includes them; training still skips them), and a values-only visit's dart count is its darts in the board. Conditions are bucketed once (`src/lib/buckets.ts`: camera angle, board size as a share of the photo, light, darts in the board, grouping) for both the breakdown and coverage; a bucket is thin under 30 photos or under 10 in verify. Pages: Verification (accuracy by model, every verification and training check), one verification (each model against the bar with the change from the first, a column chart per condition for visit, segment or board found, and the worst photos with the board and tips the model found over the true tips), Models (select two to four and compare on the verify set, verify one, download the Core ML package as a zip or the checkpoint) and Overview (accuracy by model, coverage by condition with thin buckets marked).

- **L5 (model pull and review):** `GET /api/models/active` lists the active model's Core ML package file by file and `GET /api/models/:id/files/...` serves each. Capture's Settings shows Lab's active model against the phone's and **Get vN from Lab** downloads it into `Documents/models/.incoming`, checks every file's size, then swaps it in for `DartKeypoints.mlpackage` (removing any `.mlmodelc` or `.mlmodel` dropped in by hand, which dart-vision would otherwise load first), records it in `installed.json` and reloads (`reloadModelAsync`, new in dart-vision); a failed download leaves the old model. Home says when Lab's model isn't on the phone. Each label now carries the model's **proposal** (`prefill`: its calibration points and the tips it placed, as placed) beside what the player confirmed, also when the player re-marked the board. Lab compares the two on the board in mm (`lib/prefill.ts`; moved more than 3 mm is a correction) into `prefills` and `prefill_points`; a label not kept as placed gets the review reason "corrected from model", and those lead the To review queue. The label editor draws what the model placed under the label (dashed board, ✕ tips) with how much was kept, and **Looks right** takes a corrected label out of the queue without a new version. The editor marks what each review reason is about (`lib/needs.ts`): a Needs review list above the darts (click one to select it), the dart rows and board points filled red (mismatch, the board point furthest out) or amber (on the wire, not placed), and a disc of the same colour behind each on the photo. A "To place" ribbon on the right of the row marks each board point and dart tip with no position yet (a miss or bounce-out needs no tip), and the cursor is a crosshair while one is waiting to be placed. The gallery puts a "To label" ribbon on a photo that still needs labelling: one sent from the phone to label here, a board point not placed, or a dart with any value but a miss or bounce-out and no tip (`needsLabelling`). Overview and Models show, per model, visits kept as placed, tips kept and board kept: the L5 measure.

### Trying a training run

1. `cd ml && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt` (Lab runs `ml/.venv/bin/python`; set `TONUP_LAB_PYTHON` for another).
2. Set the DeepDarts folder on Sessions, then `cd lab && pnpm build && pnpm start`.
3. Runs › New run › from scratch with DeepDarts, Epochs 1 first to time an epoch, then the full baseline.
4. Once there are verify photos: Models › select two › Compare on the verify set.

- **Deleting (after L5):** `DELETE /api/captures/:id` and `DELETE /api/sessions/:id` remove captures with their labels, measurements, pre-fill and photo files (the label editor's Delete, and each row on Sessions, both confirm first). Snapshots hard-link their photos, so past runs and their verification results are untouched; a deleted photo just drops out of the worst-photos gallery. Importing or uploading the same capture again brings it back as new, in the same set.

### Trying the model pull

1. On Lab's Models page, set a model with a Core ML package active.
2. Rebuild Capture once (`pnpm capture:sync`, then `pnpm capture:ios`): dart-vision's reload is native.
3. Capture › Settings › Get vN from Lab. Snap a visit: the board and tips are placed, and Overview's "Labelling with the model" counts what you kept.

### Trying Capture

1. `pnpm capture:sync`, then `pnpm capture:release` with the iPhone connected and unlocked: a Release build carries its JavaScript, so it runs without a dev server (`pnpm capture:ios` is the Debug build for `pnpm capture:start`). `pnpm ios:sync` switches back to Ton Up.
2. On the Mac: `cd lab && pnpm dev:lan`. Find the Mac's name in System Settings › General › Sharing (Local hostname, for example `my-mac.local`).
3. In Capture: Settings › Lab address `my-mac.local:3100`, Test. iOS asks for local-network access the first time.
4. Start a session, snap, label, save. The visit goes to Lab straight away, or waits in the outbox until Lab is back.

## Risks and findings

- **Routes directory per variant (checked in L0):** expo-router's `root` plugin option exists in SDK 58, and Expo CLI uses it for the dev server, `expo export` and the Xcode bundling step. Exporting both variants confirmed each bundle holds only its own routes. Capture's strings are added at runtime by its layout, so they aren't in Ton Up's bundle either.
- **Variant in Xcode builds:** a build started from Xcode doesn't inherit the shell's `APP_VARIANT`, so `plugins/with-app-variant.js` writes it into `ios/.xcode.env` at prebuild, and Xcode's bundling step bundles the variant that was prebuilt.
- **Stale workspace after switching variants (found in L5):** an Xcode window still open on the other variant saves its `.xcworkspace` back into the regenerated `ios/`, and `expo run:ios` picked it ("does not contain a scheme named TUCapture"). The run scripts first remove any workspace whose project is gone (`scripts/stale-workspaces.mjs`).
- **Typed routes:** `.expo/types/router.d.ts` is regenerated for whichever variant's dev server ran last. After running Capture, start Ton Up's dev server once (`pnpm start`) before `pnpm check`, or its route types fail.
- **Next.js importing `../src/domain` (checked in L0):** works with `turbopack.root` and `outputFileTracingRoot` set to the repository and `experimental.externalDir`; `pnpm build` and the scoring self-check pass.
- **Ant Design in server components:** compound components (`Layout.Header`, `Descriptions.Item`) are undefined on the server, so pages read data in a server component and render through a client component.
- **Runner in dev:** hot reload can start a second runner; the `globalThis` singleton guards it, and real runs use `pnpm start`.
- **Turbopack tracing the Python path:** `path.join(repoDir(), 'ml', '.venv', 'bin', 'python')` made `next build` try to trace the virtualenv's symlinked interpreter and fail; the paths in `runner.ts` carry `turbopackIgnore`.
- **End to end (checked in L3, Linux CPU):** a four-epoch run on 52 generated captures snapshotted, trained, verified on 12 held-out photos and registered v1; export failed without coremltools as expected and the model was still registered.
- **End to end (checked in L4, Linux CPU):** a fine-tune of v1 checked itself on 15 verify photos (3 of them values only); a verification of v1 against v2 on a fresh snapshot recorded both and the breakdown; the zip download unpacks to `DartKeypoints.mlpackage/`.
- **End to end (checked in L5, Linux):** the active-model and file routes served a package (and refused a path out of it); eight Capture-style uploads with proposals gave 3 corrected labels at the head of the queue, the editor's overlay, and acceptance per model on Overview.
- **Local network:** iOS asks for local-network permission on first sync; `.local` names resolve on the home network only.

## Open questions

- Whether Lab should also accept uploads from Ton Up's own "Keep photos" captures directly, or only by folder import.
