"""Prepare images for the CornOrigins composition.

Usage (from the video/ folder):
    pip install numpy pillow opencv-python-headless scipy
    python scripts/prepare_corn_assets.py

- corn-sticker.webp, crops-cluster.webp -> resized PNG icons
- grains-sepia.webp (5 grains in one picture) -> grain-0..4.png, one grain per file,
  each on the same full-size transparent canvas so they line up when stacked.
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "corn"

# x centre of each grain in grains-sepia.webp: corn, barley, foxtail millet, barnyard millet, rice
GRAIN_CENTRES_X = [227, 521, 1035, 1385, 1730]


def resize_max(im: Image.Image, max_side: int) -> Image.Image:
    scale = max_side / max(im.size)
    if scale >= 1:
        return im
    return im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)


def split_grains() -> None:
    rgba = np.asarray(Image.open(SRC / "grains-sepia.webp").convert("RGBA"))
    alpha = rgba[..., 3]

    # seed blobs: solid parts of each drawing, assigned to the nearest grain column
    count, labels, stats, centroids = cv2.connectedComponentsWithStats((alpha > 40).astype(np.uint8), 8)
    seeds = np.zeros(alpha.shape, np.int32)
    for i in range(1, count):
        if stats[i, cv2.CC_STAT_AREA] < 300:
            continue
        grain = int(np.argmin([abs(centroids[i][0] - cx) for cx in GRAIN_CENTRES_X]))
        seeds[labels == i] = grain + 1

    # every other visible pixel (thin awns, specks) goes to the nearest seed
    _, (iy, ix) = ndimage.distance_transform_edt(seeds == 0, return_indices=True)
    owner = seeds[iy, ix]

    for g in range(len(GRAIN_CENTRES_X)):
        part = rgba.copy()
        part[owner != g + 1] = 0  # clear colour too, keeps the PNG small
        Image.fromarray(part).save(OUT / f"grain-{g}.png", optimize=True)
        ys, xs = np.nonzero(part[..., 3] > 20)
        print(f"grain-{g}.png  x {xs.min()}-{xs.max()}  y {ys.min()}-{ys.max()}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    resize_max(Image.open(SRC / "corn-sticker.webp").convert("RGBA"), 420).save(OUT / "corn.png", optimize=True)
    resize_max(Image.open(SRC / "crops-cluster.webp").convert("RGBA"), 560).save(OUT / "crops.png", optimize=True)
    split_grains()


if __name__ == "__main__":
    main()
