"""The keypoint network: a MobileNetV3-Large backbone (torchvision, BSD) with a small
upsampling head that predicts a heatmap per keypoint kind at a quarter of the input size, and
a sub-cell offset. Inputs are RGB in 0-1; ImageNet normalisation happens inside, so Core ML can
feed it camera pixels scaled by 1/255.
"""

from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn
from torchvision.models import MobileNet_V3_Large_Weights, mobilenet_v3_large

from .geometry import CHANNELS

MEAN = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
STD = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)


def _block(cin: int, cout: int) -> nn.Sequential:
    return nn.Sequential(nn.Conv2d(cin, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True))


class DartKeypoints(nn.Module):
    def __init__(self, pretrained: bool = True, width: int = 96):
        super().__init__()
        weights = MobileNet_V3_Large_Weights.IMAGENET1K_V2 if pretrained else None
        self.backbone = mobilenet_v3_large(weights=weights).features
        # Feature taps at strides 4, 8, 16 and 32.
        self.taps = (3, 6, 12, 16)
        chans = (24, 40, 112, 960)
        self.lateral = nn.ModuleList(nn.Conv2d(c, width, 1) for c in chans)
        self.smooth = _block(width, width)
        self.heat = nn.Conv2d(width, len(CHANNELS), 1)
        self.offset = nn.Conv2d(width, 2, 1)
        nn.init.constant_(self.heat.bias, -2.19)  # starts near 0.1, as in CenterNet
        self.register_buffer("mean", MEAN)
        self.register_buffer("std", STD)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        x = (x - self.mean) / self.std
        feats = []
        for i, layer in enumerate(self.backbone):
            x = layer(x)
            if i in self.taps:
                feats.append(x)
        # Top-down: add each coarser level, upsampled, to the next finer one.
        y = self.lateral[-1](feats[-1])
        for lat, f in zip(reversed(self.lateral[:-1]), reversed(feats[:-1])):
            # Each level is exactly twice the next coarser one (512 input), so a fixed scale
            # keeps the graph free of shape arithmetic, which Core ML conversion dislikes.
            y = F.interpolate(y, scale_factor=2.0, mode="nearest") + lat(f)
        y = self.smooth(y)
        return torch.sigmoid(self.heat(y)), torch.sigmoid(self.offset(y))


def focal_loss(pred: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    """CenterNet's penalty-reduced focal loss, per channel, skipping channels not labelled."""
    pred = pred.clamp(1e-4, 1 - 1e-4)
    pos = target.eq(1).float()
    neg = 1 - pos
    m = mask[:, :, None, None]
    pos_loss = torch.log(pred) * (1 - pred) ** 2 * pos * m
    neg_loss = torch.log(1 - pred) * pred**2 * (1 - target) ** 4 * neg * m
    n = (pos * m).sum().clamp(min=1)
    return -(pos_loss.sum() + neg_loss.sum()) / n


def offset_loss(pred: torch.Tensor, target: torch.Tensor, mask: torch.Tensor) -> torch.Tensor:
    m = mask[:, None]
    return (F.l1_loss(pred * m, target * m, reduction="sum")) / mask.sum().clamp(min=1)
