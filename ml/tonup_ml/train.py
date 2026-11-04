"""Train the keypoint model.

    python -m tonup_ml.train --deepdarts data/deepdarts --captures data/captures --out runs/base

Uses the Mac's GPU (MPS) when there is one. Saves the best checkpoint by visit-score accuracy
on the validation split. With --metrics, writes one JSON line per epoch (Lab charts these).
"""

from __future__ import annotations

import argparse
import json
import random
import time
from pathlib import Path

import torch

from .data import KeypointDataset, captures, deepdarts, split_for
from .evaluate import evaluate
from .model import DartKeypoints, focal_loss, offset_loss


def device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def load_samples(args) -> tuple[list, list]:
    """DeepDarts and our captures, separately (fine-tunes can sample DeepDarts per epoch)."""
    dd = deepdarts(Path(args.deepdarts)) if args.deepdarts else []
    ours = captures(Path(args.captures)) if args.captures else []
    return dd, ours


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
    ap.add_argument("--metrics", help="Append one JSON line per epoch to this file")
    ap.add_argument(
        "--deepdarts-sample",
        type=int,
        default=0,
        help="Train on this many DeepDarts photos per epoch, drawn afresh each epoch (fine-tunes)",
    )
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args(argv)

    dd, ours = load_samples(args)
    if args.limit:
        dd, ours = dd[: args.limit], ours[: args.limit]
    if not dd and not ours:
        raise SystemExit("No samples: pass --deepdarts and/or --captures")
    every = dd + ours
    dd_train = [s for s in dd if split_for(s) == "train"] or dd
    ours_train = [s for s in ours if split_for(s) == "train"] or ours
    val = [s for s in every if split_for(s) == "val"] or every[: max(1, len(every) // 10)]
    rng = random.Random(args.seed)

    def epoch_samples() -> list:
        # Our own photos count more: they're the angles and boards the app will see.
        sampled = rng.sample(dd_train, min(args.deepdarts_sample, len(dd_train))) if args.deepdarts_sample else dd_train
        return sampled + ours_train * args.capture_weight

    per_epoch = len(epoch_samples())
    print(
        f"{per_epoch} training samples per epoch ({len(dd_train)} DeepDarts, {len(ours_train)} ours "
        f"x{args.capture_weight}) and {len(val)} validation samples",
        flush=True,
    )

    dev = device()
    model = DartKeypoints(pretrained=not (args.resume or args.no_pretrained)).to(dev)
    if args.resume:
        model.load_state_dict(torch.load(args.resume, map_location=dev)["model"])
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    steps_per_epoch = max(1, per_epoch // args.batch + 1)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * steps_per_epoch)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    metrics_file = Path(args.metrics) if args.metrics else None
    best = -1.0
    for epoch in range(args.epochs):
        train = epoch_samples()
        loader = torch.utils.data.DataLoader(
            KeypointDataset(train, train=True, seed=args.seed + epoch),
            batch_size=args.batch,
            shuffle=True,
            num_workers=args.workers,
            drop_last=len(train) > args.batch,
        )
        model.train()
        t0, total = time.time(), 0.0
        every_n = max(1, len(loader) // 20)
        for step, batch in enumerate(loader, 1):
            x = batch["image"].to(dev)
            heat, off = model(x)
            loss = focal_loss(heat, batch["heat"].to(dev), batch["mask"].to(dev)) + offset_loss(
                off, batch["offset"].to(dev), batch["offset_mask"].to(dev)
            )
            opt.zero_grad()
            loss.backward()
            opt.step()
            if sched.last_epoch < sched.total_steps - 1:
                sched.step()
            total += float(loss.detach())
            if step % every_n == 0 or step == len(loader):
                print(f"epoch {epoch + 1} step {step}/{len(loader)}", flush=True)
        metrics = evaluate(model, val, dev)
        print(
            f"epoch {epoch + 1}/{args.epochs} loss {total / max(1, len(loader)):.4f} "
            f"visits {metrics['visit_correct']:.3f} darts {metrics['dart_correct']:.3f} "
            f"board {metrics['board_found']:.3f} val loss {metrics['loss']:.4f} ({time.time() - t0:.0f}s)",
            flush=True,
        )
        improved = metrics["visit_correct"] > best
        torch.save({"model": model.state_dict(), "metrics": metrics, "epoch": epoch}, out / "last.pt")
        if improved:
            best = metrics["visit_correct"]
            torch.save({"model": model.state_dict(), "metrics": metrics, "epoch": epoch}, out / "best.pt")
            (out / "best.json").write_text(json.dumps({"epoch": epoch, **metrics}, indent=2))
        if metrics_file:
            line = {
                "epoch": epoch + 1,
                "epochs": args.epochs,
                "loss": total / max(1, len(loader)),
                "val_loss": metrics["loss"],
                "visit_correct": metrics["visit_correct"],
                "dart_correct": metrics["dart_correct"],
                "board_found": metrics["board_found"],
                "seconds": time.time() - t0,
                "images_per_second": len(train) / max(1e-6, time.time() - t0),
                "best": improved,
            }
            with metrics_file.open("a") as f:
                f.write(json.dumps(line) + "\n")


if __name__ == "__main__":
    main()
