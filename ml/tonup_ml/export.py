"""Export to Core ML for the app (modules/dart-vision).

    python -m tonup_ml.export --checkpoint runs/base/best.pt --version 2026.11.1 --out DartKeypoints.mlpackage
    xcrun coremlcompiler compile DartKeypoints.mlpackage ../modules/dart-vision/ios/Models/

The model takes `image` (RGB, 512 × 512, the whole photo scaled to fit) and returns
`heatmaps` [1, 6, 128, 128] and `offsets` [1, 2, 128, 128], matching HeatmapDecoder in Swift.
"""

from __future__ import annotations

import argparse

import torch

from .data import INPUT
from .geometry import CHANNELS
from .model import DartKeypoints


def main(argv: list[str] | None = None) -> None:
    import coremltools as ct

    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", required=True)
    ap.add_argument("--version", required=True)
    ap.add_argument("--out", default="DartKeypoints.mlpackage")
    args = ap.parse_args(argv)

    model = DartKeypoints(pretrained=False)
    model.load_state_dict(torch.load(args.checkpoint, map_location="cpu")["model"])
    model.eval()
    traced = torch.jit.trace(model, torch.rand(1, 3, INPUT, INPUT))
    ml = ct.convert(
        traced,
        inputs=[ct.ImageType(name="image", shape=(1, 3, INPUT, INPUT), scale=1 / 255.0, color_layout=ct.colorlayout.RGB)],
        outputs=[ct.TensorType(name="heatmaps"), ct.TensorType(name="offsets")],
        minimum_deployment_target=ct.target.iOS18,
        compute_precision=ct.precision.FLOAT16,
    )
    ml.author = "Ton Up"
    ml.short_description = "Dart tips and board keypoints (" + ", ".join(CHANNELS) + ")"
    ml.version = args.version
    ml.user_defined_metadata["tonup.version"] = args.version
    ml.user_defined_metadata["tonup.channels"] = ",".join(CHANNELS)
    ml.save(args.out)
    print(f"Saved {args.out}")


if __name__ == "__main__":
    main()
