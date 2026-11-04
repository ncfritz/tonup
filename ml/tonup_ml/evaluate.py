"""Evaluation by what matters in a game (docs/plan/snap-to-score.md → Accuracy bar): the visit
total right, each dart's segment right, and the board found.

    python -m tonup_ml.evaluate --checkpoint runs/base/best.pt --captures data/captures --split test \
        --out eval.json --predictions predictions.jsonl
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from .data import KeypointDataset, captures, deepdarts, split_for
from .decode import as_calibration, decode
from .geometry import apply, fit_board, parse_value, score
from .model import focal_loss, offset_loss

MAX_RESIDUAL_MM = 8.0


def _scores(calibration: dict, tips: list) -> list[tuple[int, int, int]] | None:
    fit = fit_board(calibration)
    if fit is None:
        return None
    h, _ = fit
    return [score(*p) for p in apply(h, np.array(tips))] if tips else []


@torch.no_grad()
def evaluate(
    model: torch.nn.Module,
    samples: list,
    dev: torch.device,
    limit: int = 0,
    records: list | None = None,
) -> dict[str, float]:
    """Visit, dart and board accuracy, and the loss, over `samples`. With `records`, appends
    one dict per photo: what was predicted and whether it was right (for Lab's failure gallery).
    A values-only sample (Lab) is judged on its entered values: the visit total and the darts'
    segments, with no loss since it has no points."""
    model.eval()
    chosen = samples[:limit] if limit else samples
    ds = KeypointDataset(chosen, train=False)
    visits = darts_right = darts = found = n = 0
    loss_sum = 0.0
    with_loss = 0
    for i in range(len(ds)):
        item = ds[i]
        values = chosen[i].values
        heat, off = model(item["image"][None].to(dev))
        pred = decode(heat[0].cpu(), off[0].cpu())
        cal = as_calibration(pred)
        fit = fit_board(cal)
        ok_board = fit is not None and fit[1] < MAX_RESIDUAL_MM
        if values is None:
            truth = json.loads(item["truth"])
            loss_sum += float(
                focal_loss(heat, item["heat"][None].to(dev), item["mask"][None].to(dev))
                + offset_loss(off, item["offset"][None].to(dev), item["offset_mask"][None].to(dev))
            )
            with_loss += 1
            true_cal = {c: tuple(p[0]) for c, p in truth.items() if c != "tip" and p}
            want = _scores(true_cal, [tuple(p) for p in truth["tip"]])
        else:
            parsed = [parse_value(v) for v in values]
            # Darts that missed the board have no tip in the photo to find.
            want = None if None in parsed else [p for p in parsed if p and p[2] > 0]
        if want is None:
            continue
        n += 1
        found += ok_board
        tips = [p[:2] for p in pred["tip"][: len(want)]]
        got = _scores(cal, tips) if ok_board else None
        darts += len(want)
        right = 0
        visit_ok = False
        if got is not None:
            # Segments right as a multiset (order doesn't matter in a visit).
            g = sorted((s, m) for s, m, _ in got)
            w = sorted((s, m) for s, m, _ in want)
            right = sum(min(g.count(k), w.count(k)) for k in set(w))
            visit_ok = sum(p for *_, p in got) == sum(p for *_, p in want)
        darts_right += right
        visits += visit_ok
        if records is not None:
            s = chosen[i]
            records.append(
                {
                    "image": s.image.name,
                    "group": s.group,
                    "values_only": s.values is not None,
                    "board_found": bool(ok_board),
                    "darts": len(want),
                    "darts_right": right,
                    "visit_correct": bool(visit_ok),
                    "want_total": sum(p for *_, p in want),
                    "got_total": sum(p for *_, p in got) if got is not None else None,
                    "predicted": {
                        "calibration": {c: [round(v, 5) for v in p] for c, p in cal.items()},
                        "tips": [[round(v, 5) for v in p] for p in tips],
                    },
                }
            )
    return {
        "samples": n,
        "visit_correct": visits / max(1, n),
        "dart_correct": darts_right / max(1, darts),
        "board_found": found / max(1, n),
        "loss": loss_sum / max(1, with_loss),
    }


def main(argv: list[str] | None = None) -> None:
    from .model import DartKeypoints
    from .train import device

    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--deepdarts")
    ap.add_argument("--captures")
    ap.add_argument("--split", default="test", choices=["train", "val", "test", "all"])
    ap.add_argument("--out", help="Write the totals here as JSON")
    ap.add_argument("--predictions", help="Write one JSON line per photo here")
    args = ap.parse_args(argv)
    samples = []
    if args.deepdarts:
        samples += deepdarts(Path(args.deepdarts))
    if args.captures:
        samples += captures(Path(args.captures), values_only=True)
    if args.split != "all":
        samples = [s for s in samples if split_for(s) == args.split]
    dev = device()
    model = DartKeypoints(pretrained=False).to(dev)
    model.load_state_dict(torch.load(args.checkpoint, map_location=dev)["model"])
    records: list = []
    result = evaluate(model, samples, dev, records=records if args.predictions else None)
    print(json.dumps(result, indent=2))
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2))
    if args.predictions:
        Path(args.predictions).write_text("".join(json.dumps(r) + "\n" for r in records))


if __name__ == "__main__":
    main()
