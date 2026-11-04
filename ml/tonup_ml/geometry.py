"""Board geometry and scoring, matching src/domain/board and src/domain/camera.

Board space is millimetres with the bull at (0, 0), x to the right and y up. Image points are
normalised (0-1) with the origin at the top left.
"""

from __future__ import annotations

import math

import numpy as np

SEGMENT_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
SEGMENT_DEGREES = 360 / 20
INNER_BULL, OUTER_BULL = 6.35, 15.9
TREBLE_INNER, TREBLE_OUTER = 99.0, 107.0
DOUBLE_INNER, DOUBLE_OUTER = 162.0, 170.0

# Keypoint channels, in the model's output order: the four DeepDarts calibration points, the
# bull, then dart tips.
CALIBRATION_IDS = ["cal20", "cal6", "cal3", "cal11", "bull"]
CHANNELS = CALIBRATION_IDS + ["tip"]
CALIBRATION_DEGREES = {
    "cal20": -SEGMENT_DEGREES / 2,
    "cal6": 90 - SEGMENT_DEGREES / 2,
    "cal3": 180 - SEGMENT_DEGREES / 2,
    "cal11": 270 - SEGMENT_DEGREES / 2,
}


def polar(radius: float, deg: float) -> tuple[float, float]:
    rad = math.radians(deg)
    return radius * math.sin(rad), radius * math.cos(rad)


def board_point(cid: str) -> tuple[float, float]:
    if cid == "bull":
        return 0.0, 0.0
    return polar(DOUBLE_OUTER, CALIBRATION_DEGREES[cid])


def score(x: float, y: float) -> tuple[int, int, int]:
    """(segment, multiplier, points) for a board point; segment 0 is a miss, 25 the bull."""
    d = math.hypot(x, y)
    if d <= INNER_BULL:
        return 25, 2, 50
    if d <= OUTER_BULL:
        return 25, 1, 25
    if d > DOUBLE_OUTER:
        return 0, 0, 0
    deg = (math.degrees(math.atan2(x, y)) + 360 + SEGMENT_DEGREES / 2) % 360
    seg = SEGMENT_ORDER[int(deg // SEGMENT_DEGREES) % 20]
    mult = 3 if TREBLE_INNER < d <= TREBLE_OUTER else 2 if d > DOUBLE_INNER else 1
    return seg, mult, seg * mult


def parse_value(v: str) -> tuple[int, int, int] | None:
    """(segment, multiplier, points) for an entered value ("T20", "D16", "5", "Bull", "25",
    "Miss"), as score() gives them; None for one it can't read. A miss or bounce-out scores
    nothing and has no tip."""
    s = v.strip().upper().replace(" ", "")
    if s in ("BULL", "50", "DB", "D25"):
        return 25, 2, 50
    if s in ("25", "SB", "OB"):
        return 25, 1, 25
    if s in ("MISS", "M", "0", "BOUNCE-OUT", "BOUNCEOUT", "BO"):
        return 0, 0, 0
    mult = {"S": 1, "D": 2, "T": 3}.get(s[:1])
    num = s[1:] if mult else s
    if not num.isdigit() or not 1 <= int(num) <= 20:
        return None
    m = mult or 1
    return int(num), m, int(num) * m


def fit_homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray | None:
    """3x3 homography taking src points to dst points (N >= 4), least squares beyond four."""
    if len(src) < 4:
        return None
    rows, rhs = [], []
    for (u, v), (x, y) in zip(src, dst):
        rows.append([u, v, 1, 0, 0, 0, -u * x, -v * x])
        rhs.append(x)
        rows.append([0, 0, 0, u, v, 1, -u * y, -v * y])
        rhs.append(y)
    a, b = np.asarray(rows, float), np.asarray(rhs, float)
    h, *_ = np.linalg.lstsq(a, b, rcond=None)
    if not np.all(np.isfinite(h)):
        return None
    return np.append(h, 1.0).reshape(3, 3)


def apply(h: np.ndarray, pts: np.ndarray) -> np.ndarray:
    p = np.c_[pts, np.ones(len(pts))] @ h.T
    return p[:, :2] / p[:, 2:3]


def fit_board(calibration: dict[str, tuple[float, float]]) -> tuple[np.ndarray, float] | None:
    """Image (normalised) to board (mm) from at least four keypoints, and the worst residual."""
    ids = [c for c in CALIBRATION_IDS if c in calibration]
    if len(ids) < 4:
        return None
    src = np.array([calibration[c] for c in ids])
    dst = np.array([board_point(c) for c in ids]) / DOUBLE_OUTER
    h = fit_homography(src, dst)
    if h is None:
        return None
    h = np.diag([DOUBLE_OUTER, DOUBLE_OUTER, 1.0]) @ h
    res = np.linalg.norm(apply(h, src) - dst * DOUBLE_OUTER, axis=1).max()
    return h, float(res)


def visit_score(calibration: dict[str, tuple[float, float]], tips: list[tuple[float, float]]) -> int | None:
    fit = fit_board(calibration)
    if fit is None:
        return None
    h, _ = fit
    if not tips:
        return 0
    return int(sum(score(*p)[2] for p in apply(h, np.array(tips))))
