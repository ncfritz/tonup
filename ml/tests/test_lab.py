"""The pieces Lab drives (docs/plan/capture-lab.md › Changes to ml/): reading Lab's snapshot
labels, the per-epoch metrics file, DeepDarts sampling, and evaluation's output files."""

from __future__ import annotations

import json
from pathlib import Path

from tonup_ml import evaluate as evaluate_cli
from tonup_ml import train as train_cli
from tonup_ml.data import captures, split_for, split_of

from test_ml import synthetic


def lab_file(tmp: Path, i: int, **extra) -> None:
    """Rewrites synthetic capture i in Lab's snapshot format."""
    meta = json.loads((tmp / f"{i}.json").read_text())
    meta["darts"] = [{**d, "value": "T20"} for d in meta["darts"]] + [{"x": None, "y": None, "value": "Miss"}]
    meta.update(extra)
    (tmp / f"{i}.json").write_text(json.dumps(meta))


def test_reads_lab_snapshot_labels(tmp_path):
    synthetic(tmp_path, 3)
    lab_file(tmp_path, 0, sessionId="sess-a", split="test")
    lab_file(tmp_path, 1, sessionId="sess-b")
    lab_file(tmp_path, 2, sessionId="sess-c", valuesOnly=True)
    (tmp_path / "manifest.json").write_text("{}")
    samples = {s.image.name: s for s in captures(tmp_path)}
    # Values-only captures have no tips to learn from.
    assert sorted(samples) == ["0.jpg", "1.jpg"]
    a, b = samples["0.jpg"], samples["1.jpg"]
    assert (a.group, split_for(a)) == ("sess-a", "test")
    assert (b.group, split_for(b)) == ("sess-b", split_of("sess-b"))
    # Darts with no tip (Miss) aren't points.
    assert len(a.points["tip"]) == 3


def test_split_matches_lab():
    # The same values Lab's splitOf test uses (lab/src/lib/splits.test.ts).
    assert split_of("2026-11-03") == "val"
    assert split_of("session-a") == "train"
    assert split_of("x") == "test"


def test_training_writes_metrics_and_evaluation_writes_files(tmp_path):
    data = tmp_path / "captures"
    data.mkdir()
    synthetic(data, 6)
    for i in range(6):
        lab_file(data, i, sessionId=f"s{i}", split="train" if i < 4 else "val" if i == 4 else "test")
    out = tmp_path / "run"
    metrics = out / "metrics.jsonl"
    train_cli.main(
        [
            "--captures", str(data), "--out", str(out), "--epochs", "2", "--batch", "2",
            "--workers", "0", "--no-pretrained", "--capture-weight", "1", "--metrics", str(metrics),
        ]
    )
    lines = [json.loads(l) for l in metrics.read_text().splitlines()]
    assert [l["epoch"] for l in lines] == [1, 2]
    assert {"loss", "val_loss", "visit_correct", "dart_correct", "board_found", "seconds", "best"} <= set(lines[0])
    assert lines[0]["best"] is True
    assert (out / "best.pt").exists() and (out / "best.json").exists()

    evaluate_cli.main(
        [
            "--checkpoint", str(out / "best.pt"), "--captures", str(data), "--split", "test",
            "--out", str(out / "eval.json"), "--predictions", str(out / "predictions.jsonl"),
        ]
    )
    totals = json.loads((out / "eval.json").read_text())
    assert totals["samples"] == 1
    rows = [json.loads(l) for l in (out / "predictions.jsonl").read_text().splitlines()]
    assert rows[0]["image"] == "5.jpg" and rows[0]["group"] == "s5"
    assert {"board_found", "darts", "darts_right", "visit_correct", "predicted"} <= set(rows[0])
