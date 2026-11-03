"""Evaluation by what matters in a game (docs/plan/snap-to-score.md → Accuracy bar): the visit
total right, each dart's segment right, and the board found.

    python -m tonup_ml.evaluate --checkpoint runs/base/best.pt --captures data/captures --split test
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch

from .data import KeypointDataset, captures, deepdarts, split_of
from .decode import as_calibration, decode
from .geometry import apply, fit_board, score

MAX_RESIDUAL_MM = 8.0


def _scores(calibration: dict, tips: list) -> list[tuple[int, int, int]] | None:
    fit = fit_board(calibration)
    if fit is None:
        return None
    h, _ = fit
    return [score(*p) for p in apply(h, np.array(tips))] if tips else []


@torch.no_grad()
def evaluate(model: torch.nn.Module, samples: list, dev: torch.device, limit: int = 0) -> dict[str, float]:
    model.eval()
    ds = KeypointDataset(samples[:limit] if limit else samples, train=False)
    visits = darts_right = darts = found = n = 0
    for i in range(len(ds)):
        item = ds[i]
        truth = json.loads(item["truth"])
        heat, off = model(item["image"][None].to(dev))
        pred = decode(heat[0].cpu(), off[0].cpu())
        cal = as_calibration(pred)
        fit = fit_board(cal)
        ok_board = fit is not None and fit[1] < MAX_RESIDUAL_MM
        true_cal = {c: tuple(p[0]) for c, p in truth.items() if c != "tip" and p}
        want = _scores(true_cal, [tuple(p) for p in truth["tip"]])
        if want is None:
            continue
        n += 1
        found += ok_board
        tips = [p[:2] for p in pred["tip"][: len(truth["tip"])]]
        got = _scores(cal, tips) if ok_board else None
        darts += len(want)
        if got is not None:
            # Segments right as a multiset (order doesn't matter in a visit).
            g = sorted((s, m) for s, m, _ in got)
            w = sorted((s, m) for s, m, _ in want)
            darts_right += sum(min(g.count(k), w.count(k)) for k in set(w))
            visits += sum(p for *_, p in got) == sum(p for *_, p in want)
    return {
        "samples": n,
        "visit_correct": visits / max(1, n),
        "dart_correct": darts_right / max(1, darts),
        "board_found": found / max(1, n),
    }


def main(argv: list[str] | None = None) -> None:
    from .model import DartKeypoints
    from .train import device

    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--deepdarts")
    ap.add_argument("--captures")
    ap.add_argument("--split", default="test", choices=["train", "val", "test", "all"])
    args = ap.parse_args(argv)
    samples = []
    if args.deepdarts:
        samples += deepdarts(Path(args.deepdarts))
    if args.captures:
        samples += captures(Path(args.captures))
    if args.split != "all":
        samples = [s for s in samples if split_of(s.group) == args.split]
    dev = device()
    model = DartKeypoints(pretrained=False).to(dev)
    model.load_state_dict(torch.load(args.checkpoint, map_location=dev)["model"])
    print(json.dumps(evaluate(model, samples, dev), indent=2))


if __name__ == "__main__":
    main()
