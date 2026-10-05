"""Prepare the illustration PNGs and the paper background used by the video.

Usage (from the video/ folder):
    pip install numpy pillow opencv-python-headless
    python scripts/prepare_assets.py

Inputs : assets-src/*.webp  (illustrations with transparent background)
Outputs: public/images/pack.png, jajangmyeon.png, money.png, paper.jpg
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-src"
OUT = ROOT / "public" / "images"

# Cream "sticker" border colour, sampled from the reference video.
STICKER_RGB = (248, 241, 230)


def load_rgba(name: str) -> np.ndarray:
    return np.asarray(Image.open(SRC / name).convert("RGBA")).copy()


def keep_main_component(rgba: np.ndarray) -> np.ndarray:
    """Drop stray specks: keep only the largest connected alpha blob."""
    mask = (rgba[..., 3] > 8).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    if count <= 2:
        return rgba
    main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    out = rgba.copy()
    out[labels != main] = 0
    return out


def add_sticker_border(rgba: np.ndarray, radius: int, pad: int | None = None) -> np.ndarray:
    """Put a solid cream outline of `radius` px behind the drawing."""
    pad = pad if pad is not None else radius + 4
    rgba = np.pad(rgba, ((pad, pad), (pad, pad), (0, 0)))
    alpha = rgba[..., 3].astype(np.float32) / 255.0
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * radius + 1, 2 * radius + 1))
    grown = cv2.dilate((alpha > 0.5).astype(np.uint8), kernel).astype(np.float32)
    grown = cv2.GaussianBlur(grown, (0, 0), 0.8)  # anti-aliased edge

    base = np.zeros_like(rgba, dtype=np.float32)
    base[..., :3] = STICKER_RGB
    base[..., 3] = grown

    # "over" composite of the drawing on top of the cream silhouette
    fg = rgba.astype(np.float32)
    fa = alpha[..., None]
    out_a = fa[..., 0] + base[..., 3] * (1 - fa[..., 0])
    out_rgb = (fg[..., :3] * fa + base[..., :3] * base[..., 3:4] * (1 - fa)) / np.maximum(out_a[..., None], 1e-6)
    out = np.dstack([out_rgb, out_a * 255.0])
    return np.clip(out, 0, 255).astype(np.uint8)


def crop_to_content(rgba: np.ndarray, margin: int = 2) -> np.ndarray:
    ys, xs = np.nonzero(rgba[..., 3] > 2)
    y0, y1 = max(ys.min() - margin, 0), min(ys.max() + margin + 1, rgba.shape[0])
    x0, x1 = max(xs.min() - margin, 0), min(xs.max() + margin + 1, rgba.shape[1])
    return rgba[y0:y1, x0:x1]


def resize_max(rgba: np.ndarray, max_side: int) -> np.ndarray:
    h, w = rgba.shape[:2]
    scale = max_side / max(h, w)
    if scale >= 1:
        return rgba
    im = Image.fromarray(rgba).resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    return np.asarray(im)


def save(rgba: np.ndarray, name: str) -> None:
    Image.fromarray(rgba).save(OUT / name, optimize=True)
    print(f"{name}: {rgba.shape[1]}x{rgba.shape[0]}")


def make_paper(width: int = 1920, height: int = 960, seed: int = 7) -> None:
    """Warm paper texture matched to the reference (soft mottling + vignette)."""
    rng = np.random.default_rng(seed)

    def band(sigma: float, std: float) -> np.ndarray:
        n = cv2.GaussianBlur(rng.standard_normal((height, width)).astype(np.float32), (0, 0), sigma)
        return n / (n.std() + 1e-6) * std

    lum = np.zeros((height, width), np.float32)
    for sigma, std in ((260, 1.7), (120, 1.0), (60, 0.6), (28, 0.45), (12, 0.4), (5, 0.45), (2, 0.6), (0.7, 0.9)):
        lum += band(sigma, std)

    # a few faint cloudy stains, like old paper
    stains = band(45, 1.0)
    lum -= np.clip(stains - 1.2, 0, None) * 1.6

    # vignette: flat in the middle, ~7 levels darker in the corners
    yy, xx = np.mgrid[0:height, 0:width].astype(np.float32)
    r = np.sqrt(((xx - width / 2) / (width / 2)) ** 2 + ((yy - height / 2) / (height / 2)) ** 2)
    lum -= np.clip(r - 0.55, 0, None) ** 1.6 * 7.5

    # luminance -> colour (slopes measured on the reference background)
    rgb = np.dstack([242 + 0.48 * lum, 224 + 1.05 * lum, 205 + 1.47 * lum])
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8))
    img.save(OUT / "paper.jpg", quality=93)
    print(f"paper.jpg: {width}x{height}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # 담뱃갑: 큰 화면용(얇은 테두리)과 그래프 위 작은 아이콘용(두꺼운 테두리)을 같은 크기 캔버스로 만듭니다.
    pack = keep_main_component(load_rgba("pack.webp"))
    thin = add_sticker_border(pack, radius=9, pad=34)
    thick = add_sticker_border(pack, radius=30, pad=34)
    ys, xs = np.nonzero(thick[..., 3] > 2)
    box = (slice(max(ys.min() - 2, 0), ys.max() + 3), slice(max(xs.min() - 2, 0), xs.max() + 3))
    save(thin[box], "pack.png")
    save(thick[box], "pack-chart.png")

    # 그래프 위 아이콘: 작게 보일 때도 크림색 테두리가 보이도록 테두리를 더 두껍게
    jajang = resize_max(crop_to_content(keep_main_component(load_rgba("jajangmyeon.webp"))), 720)
    save(crop_to_content(add_sticker_border(jajang, radius=15)), "jajangmyeon.png")

    money = resize_max(crop_to_content(keep_main_component(load_rgba("money.webp"))), 720)
    save(crop_to_content(add_sticker_border(money, radius=14)), "money.png")

    make_paper()


if __name__ == "__main__":
    main()
