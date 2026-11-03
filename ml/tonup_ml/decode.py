"""Heatmaps to keypoints, as the app does it (modules/dart-vision/ios/DartVisionModule.swift)."""

from __future__ import annotations

import numpy as np
import torch
import torch.nn.functional as F

from .geometry import CHANNELS

THRESHOLD = 0.3
MAX_TIPS = 8


def decode(heat: torch.Tensor, offset: torch.Tensor) -> dict[str, list[tuple[float, float, float]]]:
    """One image's heatmaps [C, H, W] and offsets [2, H, W] to normalised points with confidence."""
    h, w = heat.shape[-2:]
    peaks = (heat == F.max_pool2d(heat[None], 3, 1, 1)[0]) & (heat >= THRESHOLD)
    out: dict[str, list[tuple[float, float, float]]] = {}
    for ci, c in enumerate(CHANNELS):
        ys, xs = torch.nonzero(peaks[ci], as_tuple=True)
        pts = [
            (
                (x + float(offset[0, y, x])) / w,
                (y + float(offset[1, y, x])) / h,
                float(heat[ci, y, x]),
            )
            for y, x in zip(ys.tolist(), xs.tolist())
        ]
        pts.sort(key=lambda p: -p[2])
        out[c] = pts[:1] if c != "tip" else pts[:MAX_TIPS]
    return out


def as_calibration(points: dict[str, list[tuple[float, float, float]]]) -> dict[str, tuple[float, float]]:
    return {c: p[0][:2] for c, p in points.items() if c != "tip" and p}


def nearest_match(pred: list[tuple[float, float]], truth: list[tuple[float, float]]) -> float:
    """Mean distance between matched points (greedy), for reporting tip error."""
    if not pred or not truth:
        return float("nan")
    p, t = np.array(pred), np.array(truth)
    d = np.linalg.norm(p[:, None] - t[None], axis=2)
    return float(d.min(axis=0).mean())
