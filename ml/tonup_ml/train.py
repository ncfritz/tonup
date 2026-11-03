"""Train the keypoint model.

    python -m tonup_ml.train --deepdarts data/deepdarts --captures data/captures --out runs/base

Uses the Mac's GPU (MPS) when there is one. Saves the best checkpoint by visit-score accuracy
on the validation split.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch

from .data import KeypointDataset, captures, deepdarts, split_of
from .evaluate import evaluate
from .model import DartKeypoints, focal_loss, offset_loss


def device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def load_samples(args) -> list:
    samples = []
    if args.deepdarts:
        samples += deepdarts(Path(args.deepdarts))
    if args.captures:
        # Our own photos count more: they're the angles and boards the app will see.
        ours = captures(Path(args.captures))
        samples += ours * args.capture_weight
    return samples


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--deepdarts", help="DeepDarts folder with labels.pkl and cropped_images/")
    ap.add_argument("--captures", help="Ton Up captures folder (copied from the Files app)")
    ap.add_argument("--capture-weight", type=int, default=3)
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--resume", help="Checkpoint to start from (fine-tuning on captures)")
    ap.add_argument("--out", default="runs/base")
    ap.add_argument("--limit", type=int, default=0, help="Use only this many samples (smoke test)")
    ap.add_argument("--no-pretrained", action="store_true", help="Start from random weights (offline)")
    args = ap.parse_args(argv)

    samples = load_samples(args)
    if args.limit:
        samples = samples[: args.limit]
    if not samples:
        raise SystemExit("No samples: pass --deepdarts and/or --captures")
    train = [s for s in samples if split_of(s.group) == "train"] or samples
    val = [s for s in samples if split_of(s.group) == "val"] or samples[: max(1, len(samples) // 10)]
    print(f"{len(train)} training and {len(val)} validation samples")

    dev = device()
    model = DartKeypoints(pretrained=not (args.resume or args.no_pretrained)).to(dev)
    if args.resume:
        model.load_state_dict(torch.load(args.resume, map_location=dev)["model"])
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(
        opt, max_lr=args.lr, total_steps=args.epochs * max(1, len(train) // args.batch + 1)
    )
    loader = torch.utils.data.DataLoader(
        KeypointDataset(train, train=True),
        batch_size=args.batch,
        shuffle=True,
        num_workers=args.workers,
        drop_last=len(train) > args.batch,
    )
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    best = -1.0
    for epoch in range(args.epochs):
        model.train()
        t0, total = time.time(), 0.0
        for batch in loader:
            x = batch["image"].to(dev)
            heat, off = model(x)
            loss = focal_loss(heat, batch["heat"].to(dev), batch["mask"].to(dev)) + offset_loss(
                off, batch["offset"].to(dev), batch["offset_mask"].to(dev)
            )
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            total += float(loss.detach())
        metrics = evaluate(model, val, dev)
        print(
            f"epoch {epoch + 1}/{args.epochs} loss {total / max(1, len(loader)):.4f} "
            f"visits {metrics['visit_correct']:.3f} darts {metrics['dart_correct']:.3f} "
            f"board {metrics['board_found']:.3f} ({time.time() - t0:.0f}s)"
        )
        torch.save({"model": model.state_dict(), "metrics": metrics, "epoch": epoch}, out / "last.pt")
        if metrics["visit_correct"] > best:
            best = metrics["visit_correct"]
            torch.save({"model": model.state_dict(), "metrics": metrics, "epoch": epoch}, out / "best.pt")
            (out / "best.json").write_text(json.dumps({"epoch": epoch, **metrics}, indent=2))


if __name__ == "__main__":
    main()
