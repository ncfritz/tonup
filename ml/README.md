# Snap-to-score model

Training for the keypoint model the app runs on the phone ([ADR 0011](../docs/architecture/decisions/0011-snap-to-score.md), [plan](../docs/plan/snap-to-score.md)). Everything runs on your Mac; nothing goes to a cloud service.

The model finds six kinds of keypoint in a photo: the four DeepDarts calibration points (where the 5/20, 13/6, 17/3 and 8/11 wires meet the outside of the double ring), the bull, and dart tips. It's a MobileNetV3-Large backbone with a small upsampling head predicting a heatmap per kind at a quarter of the 512 × 512 input, plus a sub-cell offset (CenterNet-style). All code and dependencies are permissively licensed (PyTorch, torchvision and coremltools are BSD).

## Setup

```sh
cd ml
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pytest -q
```

PyTorch is pinned to the version coremltools is tested with. Training uses the Mac's GPU (MPS) automatically.

## Data

- **DeepDarts** (CC BY 4.0, [IEEE DataPort](https://ieee-dataport.org/node/4367); credit "DeepDarts dataset, McNally et al., 2021" in the app's acknowledgements once a model trained on it ships). Download `cropped_images.zip` and `labels_pkl.zip` into `data/deepdarts/`, so it has `labels.pkl` and `cropped_images/800/<folder>/…`. About 16k photos, mostly face-on; it has no bull label, so that channel is masked for these.
- **Our captures:** turn on Settings › Camera › Keep photos to improve detection, play with Camera input, then copy Files › On My iPhone › Ton Up › `captures` to `data/captures/`. Each photo has a `.json` with what you confirmed (the four calibration points, the bull and the darts). Marking photos by hand before the model exists produces exactly these labels.

Splits are stable by group (DeepDarts by folder, captures by day), so photos from one session never straddle train and test.

## Train

```sh
# Baseline on DeepDarts
python -m tonup_ml.train --deepdarts data/deepdarts --out runs/base --epochs 60
# Fine-tune on our photos (our captures count three times by default)
python -m tonup_ml.train --deepdarts data/deepdarts --captures data/captures \
  --resume runs/base/best.pt --lr 3e-4 --epochs 30 --out runs/ours
```

Each epoch prints the validation numbers that matter in a game: visit total correct, dart segment correct, board found. The best checkpoint by visit accuracy is `best.pt`, with its numbers in `best.json`.

Lab runs this for you and adds `--metrics runs/<id>/metrics.jsonl` (one JSON line per epoch), `--deepdarts-sample N` (a fresh random N DeepDarts photos each epoch, so fine-tunes aren't swamped) and `--seed`. `--no-pretrained` starts from random weights when the ImageNet backbone can't be downloaded. `--captures` also reads a Lab snapshot folder, taking each photo's split from its label.

## Evaluate

```sh
python -m tonup_ml.evaluate --checkpoint runs/ours/best.pt --captures data/captures --split test
```

`--out eval.json` writes the numbers and `--predictions predictions.jsonl` one line per photo, which Lab's verification pages read.

The bar for shipping (docs/plan/snap-to-score.md): on our own test photos, dart segment correct ≥ 95%, visit correct ≥ 90%, board found ≥ 98%.

## Export

```sh
python -m tonup_ml.export --checkpoint runs/ours/best.pt --version 2026.11.1 --out DartKeypoints.mlpackage
```

- **To try it without a rebuild:** copy `DartKeypoints.mlpackage` to Files › On My iPhone › Ton Up › `models/`. The app compiles it on first use and Settings › Camera shows its version.
- **To ship it:** `xcrun coremlcompiler compile DartKeypoints.mlpackage ../modules/dart-vision/ios/Models/`, then `pnpm ios:sync`.

The model's contract is shared with `HeatmapDecoder` in `modules/dart-vision/ios/DartVisionModule.swift` and `tonup_ml/decode.py`: input `image` (RGB, 512 × 512, the whole photo scaled to fit), outputs `heatmaps` [1, 6, 128, 128] (sigmoid; cal20, cal6, cal3, cal11, bull, tip) and `offsets` [1, 2, 128, 128].
