"""Checks that the Python side agrees with the app (src/domain/board, src/domain/camera) and
that a tiny model trains end to end on synthetic photos."""

from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageDraw

from tonup_ml.data import GRID, KeypointDataset, Sample, captures
from tonup_ml.decode import decode
from tonup_ml.geometry import CALIBRATION_IDS, apply, board_point, fit_board, fit_homography, polar, score, visit_score
from tonup_ml.model import DartKeypoints, focal_loss, offset_loss


def test_scoring_matches_the_app():
    assert score(0, 103) == (20, 3, 60)
    assert score(0, 0) == (25, 2, 50)
    assert score(0, 10) == (25, 1, 25)
    assert score(*polar(166, 90)) == (6, 2, 12)
    assert score(0, 171) == (0, 0, 0)
    # Just clockwise of cal20 is the 20, just anticlockwise the 5.
    x, y = board_point("cal20")
    assert score(x * 0.97 + 1, y * 0.97)[0] == 20
    assert score(x * 0.97 - 1, y * 0.97)[0] == 5


def camera() -> np.ndarray:
    src = np.array([[-170, 170], [170, 170], [170, -170], [-170, -170]], float)
    dst = np.array([[0.22, 0.12], [0.8, 0.18], [0.74, 0.86], [0.3, 0.78]])
    return fit_homography(src, dst)


def test_homography_round_trip():
    h = camera()
    cal = {c: tuple(apply(h, np.array([board_point(c)]))[0]) for c in CALIBRATION_IDS}
    fit = fit_board(cal)
    assert fit is not None and fit[1] < 0.01
    t20 = apply(h, np.array([[0.0, 103.0]]))[0]
    assert visit_score(cal, [tuple(t20)] * 3) == 180


def test_decode_finds_peaks_with_offsets():
    heat = torch.zeros(6, GRID, GRID)
    heat[0, 10, 20] = 0.9
    heat[5, 50, 60] = 0.8
    heat[5, 70, 30] = 0.6
    off = torch.full((2, GRID, GRID), 0.5)
    pts = decode(heat, off)
    assert pts["cal20"] == [(20.5 / GRID, 10.5 / GRID, pytest_approx(0.9))]
    assert len(pts["tip"]) == 2 and pts["tip"][0][2] > pts["tip"][1][2]
    assert pts["bull"] == []


def pytest_approx(v):
    import pytest

    return pytest.approx(v, abs=1e-6)


def synthetic(tmp: Path, n: int) -> list[Sample]:
    """Plain drawn boards with dots for darts, written as app captures."""
    h = camera()
    rng = np.random.default_rng(0)
    for i in range(n):
        img = Image.new("RGB", (400, 300), (30, 30, 30))
        d = ImageDraw.Draw(img)
        ring = [tuple(apply(h, np.array([polar(170, a)]))[0] * [400, 300]) for a in range(0, 361, 5)]
        d.polygon(ring, fill=(230, 220, 190))
        cal = [{"x": float(p[0]), "y": float(p[1])} for p in (apply(h, np.array([board_point(c)]))[0] for c in CALIBRATION_IDS)]
        for c in cal:
            d.ellipse([c["x"] * 400 - 3, c["y"] * 300 - 3, c["x"] * 400 + 3, c["y"] * 300 + 3], fill=(200, 0, 0))
        darts = []
        for _ in range(3):
            r, a = rng.uniform(20, 160), rng.uniform(0, 360)
            p = apply(h, np.array([polar(r, a)]))[0]
            d.ellipse([p[0] * 400 - 4, p[1] * 300 - 4, p[0] * 400 + 4, p[1] * 300 + 4], fill=(0, 90, 255))
            darts.append({"x": float(p[0]), "y": float(p[1])})
        img.save(tmp / f"{i}.jpg")
        (tmp / f"{i}.json").write_text(
            json.dumps({"image": f"{i}.jpg", "calibration": cal, "darts": darts, "missed": 0, "createdAt": f"2026-11-0{i % 3}"})
        )
    return captures(tmp)


def test_captures_load_and_a_step_trains(tmp_path):
    samples = synthetic(tmp_path, 4)
    assert len(samples) == 4 and samples[0].labelled == set(["tip", *CALIBRATION_IDS])
    ds = KeypointDataset(samples, train=True)
    item = ds[0]
    assert item["image"].shape == (3, 512, 512)
    assert item["heat"].shape == (6, GRID, GRID)
    assert float(item["heat"][5].max()) == 1.0
    model = DartKeypoints(pretrained=False)
    batch = torch.utils.data.default_collate([ds[i] for i in range(2)])
    heat, off = model(batch["image"])
    assert heat.shape == (2, 6, GRID, GRID) and off.shape == (2, 2, GRID, GRID)
    loss = focal_loss(heat, batch["heat"], batch["mask"]) + offset_loss(off, batch["offset"], batch["offset_mask"])
    loss.backward()
    assert math.isfinite(float(loss.detach()))
