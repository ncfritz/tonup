"""Datasets: DeepDarts (CC BY 4.0, https://ieee-dataport.org/node/4367) and our own captures
(Documents/captures from the app, ADR 0011), as images with keypoint labels.

A sample is an RGB image and, per channel (cal20, cal6, cal3, cal11, bull, tip), a list of
normalised points; channels the source doesn't label are masked out of the loss (DeepDarts has
no bull label).
"""

from __future__ import annotations

import hashlib
import json
import math
import random
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageEnhance

from .geometry import CHANNELS

INPUT = 512
STRIDE = 4
GRID = INPUT // STRIDE
SIGMA = 2.0  # heatmap spread, in output cells


@dataclass
class Sample:
    image: Path
    points: dict[str, list[tuple[float, float]]]
    # Channels this sample labels (an unlabelled channel isn't "nothing there").
    labelled: set[str] = field(default_factory=set)
    group: str = ""  # for splitting: photos of one session stay together


def split_of(group: str, val: float = 0.1, test: float = 0.1) -> str:
    """A stable train/val/test split by group."""
    h = int(hashlib.sha1(group.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "test" if h < test else "val" if h < test + val else "train"


def deepdarts(root: Path) -> list[Sample]:
    """DeepDarts: labels.pkl (a pandas frame with img_folder, img_name, xy) and the crops."""
    import pandas as pd

    labels = pd.read_pickle(root / "labels.pkl")
    out = []
    for row in labels.itertuples():
        xy = [tuple(map(float, p)) for p in row.xy]
        image = root / "cropped_images" / "800" / row.img_folder / row.img_name
        points = {c: [xy[i]] for i, c in enumerate(CHANNELS[:4]) if i < len(xy)}
        points["tip"] = xy[4:]
        out.append(Sample(image, points, {"cal20", "cal6", "cal3", "cal11", "tip"}, row.img_folder))
    return out


def captures(root: Path) -> list[Sample]:
    """Our captures: <id>.jpg and <id>.json written by the app (src/features/camera/captures.ts)."""
    out = []
    for meta in sorted(root.glob("*.json")):
        m = json.loads(meta.read_text())
        points: dict[str, list[tuple[float, float]]] = {c: [] for c in CHANNELS}
        labelled = {"tip"}
        for cid, p in zip(CHANNELS[:5], m["calibration"]):
            if p is not None:
                points[cid] = [(p["x"], p["y"])]
                labelled.add(cid)
        points["tip"] = [(d["x"], d["y"]) for d in m["darts"]]
        out.append(Sample(root / m["image"], points, labelled, m.get("createdAt", meta.stem)[:10]))
    return out


def _affine(rng: random.Random, w: int, h: int) -> np.ndarray:
    """A random scale, rotation and shift in normalised coordinates (small, so the 20 stays up)."""
    s = rng.uniform(0.8, 1.2)
    a = math.radians(rng.uniform(-15, 15))
    tx, ty = rng.uniform(-0.08, 0.08), rng.uniform(-0.08, 0.08)
    c = np.array([[1, 0, -0.5], [0, 1, -0.5], [0, 0, 1]])
    r = np.array([[s * math.cos(a), -s * math.sin(a), 0], [s * math.sin(a), s * math.cos(a), 0], [0, 0, 1]])
    back = np.array([[1, 0, 0.5 + tx], [0, 1, 0.5 + ty], [0, 0, 1]])
    return back @ r @ c


class KeypointDataset(torch.utils.data.Dataset):
    def __init__(self, samples: list[Sample], train: bool, seed: int = 0):
        self.samples = samples
        self.train = train
        self.rng = random.Random(seed)

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, i: int):
        s = self.samples[i]
        img = Image.open(s.image).convert("RGB")
        m = np.eye(3)
        if self.train:
            m = _affine(self.rng, *img.size)
            # PIL wants the inverse map in pixels: output pixel -> input pixel.
            px = np.diag([img.width, img.height, 1.0])
            inv = np.linalg.inv(px @ m @ np.linalg.inv(px))
            img = img.transform(img.size, Image.Transform.AFFINE, tuple(inv[:2].ravel()), Image.Resampling.BILINEAR)
            for enhance in (ImageEnhance.Brightness, ImageEnhance.Contrast, ImageEnhance.Color):
                img = enhance(img).enhance(self.rng.uniform(0.7, 1.3))
        # The whole photo squeezed to the square input, as the app does (scaleFill).
        img = img.resize((INPUT, INPUT), Image.Resampling.BILINEAR)
        x = torch.from_numpy(np.asarray(img, np.float32) / 255.0).permute(2, 0, 1)

        heat = np.zeros((len(CHANNELS), GRID, GRID), np.float32)
        offset = np.zeros((2, GRID, GRID), np.float32)
        offset_mask = np.zeros((GRID, GRID), np.float32)
        mask = np.array([1.0 if c in s.labelled else 0.0 for c in CHANNELS], np.float32)
        yy, xx = np.mgrid[0:GRID, 0:GRID]
        truth: dict[str, list[tuple[float, float]]] = {}
        for ci, c in enumerate(CHANNELS):
            pts = []
            for p in s.points.get(c, []):
                q = m @ np.array([p[0], p[1], 1.0])
                u, v = q[0] / q[2], q[1] / q[2]
                if not (0 <= u < 1 and 0 <= v < 1):
                    continue
                pts.append((u, v))
                gx, gy = u * GRID, v * GRID
                cx, cy = int(gx), int(gy)
                g = np.exp(-((xx + 0.5 - gx) ** 2 + (yy + 0.5 - gy) ** 2) / (2 * SIGMA**2))
                heat[ci] = np.maximum(heat[ci], g)
                heat[ci, cy, cx] = 1.0
                offset[:, cy, cx] = (gx - cx, gy - cy)
                offset_mask[cy, cx] = 1.0
            truth[c] = pts
        return {
            "image": x,
            "heat": torch.from_numpy(heat),
            "mask": torch.from_numpy(mask),
            "offset": torch.from_numpy(offset),
            "offset_mask": torch.from_numpy(offset_mask),
            "truth": json.dumps(truth),
        }
