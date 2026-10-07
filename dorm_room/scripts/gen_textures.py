"""Procedurally generate the image textures used by the dorm room scene.

Everything here is synthesised with numpy/PIL so the scene has no external
asset dependencies:
  * landscape "painting" posters and small photo prints
  * two tileable plaid flannel textures for the blankets
  * an overcast exterior backdrop (trees + sky) seen through the window

Usage:  python gen_textures.py <output_dir>
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "textures")
os.makedirs(OUT, exist_ok=True)
RNG = np.random.default_rng(7)


# ----------------------------------------------------------------------------
# noise helpers
# ----------------------------------------------------------------------------
def value_noise(h, w, cells, rng, tile=False):
    """Smooth value noise: random grid upsampled bicubically."""
    gh, gw = max(2, int(cells * h / max(h, w))), max(2, int(cells * w / max(h, w)))
    g = rng.random((gh + 3, gw + 3)).astype(np.float32)
    if tile:
        g[-3:, :] = g[:3, :]
        g[:, -3:] = g[:, :3]
    im = Image.fromarray((g * 255).astype(np.uint8)).resize(
        (int(w * (gw + 3) / gw), int(h * (gh + 3) / gh)), Image.BICUBIC)
    a = np.asarray(im).astype(np.float32)[:h, :w] / 255.0
    return a


def fbm(h, w, base_cells, octaves, rng, persistence=0.5):
    out = np.zeros((h, w), np.float32)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        out += amp * value_noise(h, w, base_cells * (2 ** o), rng)
        tot += amp
        amp *= persistence
    return out / tot


def fbm1d(n, base, octaves, rng, persistence=0.55):
    x = np.zeros(n)
    amp, tot = 1.0, 0.0
    for o in range(octaves):
        k = base * 2 ** o
        pts = rng.random(k + 2)
        xs = np.linspace(0, k, n)
        i = np.floor(xs).astype(int)
        f = xs - i
        f = f * f * (3 - 2 * f)
        x += amp * (pts[i] * (1 - f) + pts[i + 1] * f)
        tot += amp
        amp *= persistence
    x = x / tot
    return (x - x.min()) / max(1e-6, x.max() - x.min())


def ridged1d(n, base, octaves, rng):
    """Sharp mountain-peak profile in 0..1 (1 = peak)."""
    r = 1 - np.abs(fbm1d(n, base, octaves, rng) * 2 - 1)
    r = r ** 1.05
    detail = fbm1d(n, base * 8, 3, rng)
    r = 0.85 * r + 0.15 * detail
    return (r - r.min()) / max(1e-6, r.max() - r.min())


def lerp(a, b, t):
    return a + (b - a) * t


def col(*c):
    return np.array(c, np.float32) / 255.0


def to_img(a):
    return Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))


def painterly(img, strength=1.0, rng=RNG):
    """Soften and add directional brush-stroke texture + canvas/paper grain."""
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(0.8 * strength))).astype(np.float32) / 255
    h, w = a.shape[:2]
    strokes = fbm(h, w, 60, 3, rng)
    strokes = np.asarray(to_img(strokes).filter(ImageFilter.GaussianBlur(1))).astype(np.float32) / 255
    stretch = Image.fromarray((strokes * 255).astype(np.uint8)).resize((w // 4, h)).resize((w, h), Image.BICUBIC)
    s = np.asarray(stretch).astype(np.float32) / 255
    a = a * (0.93 + 0.14 * s[..., None] * strength)
    grain = rng.normal(0, 0.012, (h, w, 1))
    a = a + grain
    return to_img(a)


def finish_print(a, desat=0.25, gamma=1.0, lift=0.02):
    lum = a.mean(axis=2, keepdims=True)
    a = lerp(a, lum, desat)
    a = np.clip(a, 0, 1) ** gamma
    a = a * (1 - lift) + lift
    return a


# ----------------------------------------------------------------------------
# landscape painting primitives
# ----------------------------------------------------------------------------
def sky(h, w, top, horizon, rng, cloudiness=0.6, horizon_y=0.55):
    y = np.linspace(0, 1, h)[:, None, None]
    t = np.clip(y / horizon_y, 0, 1)
    base = lerp(top, horizon, t ** 0.8) * np.ones((h, w, 3), np.float32)
    clouds = fbm(h, w, 6, 6, rng)
    stretch = np.asarray(to_img(clouds).resize((w, max(2, h // 2))).resize((w, h), Image.BICUBIC)).astype(np.float32) / 255
    c = np.clip((stretch - (1 - cloudiness) * 0.7 - 0.25) * 2.5, 0, 1)[..., None]
    shade = fbm(h, w, 12, 4, rng)[..., None]
    cloud_col = lerp(col(150, 155, 160), col(235, 235, 230), shade)
    return lerp(base, cloud_col, c * 0.85)


def mountain_layer(a, ridge, color, haze_col, haze, rng, snow=0.0):
    h, w = a.shape[:2]
    yy = np.arange(h)[:, None]
    ridge_px = (ridge * h)[None, :]
    mask = (yy >= ridge_px).astype(np.float32)
    # soft edge
    mask = np.asarray(to_img(mask).filter(ImageFilter.GaussianBlur(0.9))).astype(np.float32) / 255
    tex = fbm(h, w, 25, 5, rng)
    k = max(3, w // 60)
    smooth = np.convolve(np.pad(ridge, k, mode="edge"), np.ones(2 * k + 1) / (2 * k + 1), mode="same")[k:-k]
    dx = np.gradient(smooth)[None, :] * w
    rock = fbm(h, w, 18, 4, rng)
    light = np.clip(0.5 - dx * 1.2 + (rock - 0.5) * 0.8, 0, 1)  # slopes facing left are lit
    depth = np.clip((yy - ridge_px) / (0.25 * h), 0, 1)
    c = color[None, None, :] * (0.75 + 0.45 * light[..., None] * (1 - depth[..., None])) * (0.85 + 0.3 * tex[..., None])
    if snow > 0:
        sn = np.clip(1 - (yy - ridge_px) / (snow * h), 0, 1) * (tex > 0.45)
        c = lerp(c, col(215, 218, 222) * (0.7 + 0.4 * light[..., None]), sn[..., None] * 0.8)
    c = lerp(c, haze_col, haze)
    return lerp(a, c, mask[..., None])


def draw_pines(a, rng, n, y_range, h_range, color_dark, color_light, haze_col=None, haze=0.0, x_range=(0, 1), density_bias=None):
    h, w = a.shape[:2]
    S = 2
    layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    items = []
    for _ in range(n):
        x = rng.uniform(*x_range)
        yb = rng.uniform(*y_range)
        items.append((yb, x))
    items.sort()
    for yb, x in items:
        th = rng.uniform(*h_range) * (0.6 + 0.8 * (yb - y_range[0]) / max(1e-6, y_range[1] - y_range[0]))
        tw = th * rng.uniform(0.28, 0.42)
        shade = rng.uniform(0, 1)
        c = lerp(color_dark, color_light, shade * 0.6)
        if haze_col is not None:
            c = lerp(c, haze_col, haze)
        cc = tuple(int(v * 255) for v in np.clip(c, 0, 1)) + (255,)
        cx, by, top = x * w * S, yb * h * S, (yb - th) * h * S
        tiers = rng.integers(6, 11)
        for t in range(tiers):
            f0 = t / tiers
            f1 = (t + 1.6) / tiers
            ytop = top + (by - top) * f0
            ybot = top + (by - top) * min(1, f1)
            half = tw * w * S * 0.5 * (0.25 + 0.75 * min(1, f1)) * rng.uniform(0.85, 1.15)
            jag = []
            k = 7
            for j in range(k + 1):
                u = j / k
                xx = cx - half + 2 * half * u
                yy = ybot - rng.uniform(0, 0.25) * (ybot - ytop) * (1 - abs(u - 0.5) * 2)
                jag.append((xx, yy))
            d.polygon([(cx + rng.uniform(-1, 1) * S, ytop)] + jag[::-1], fill=cc)
        d.line([(cx, by), (cx, by - (by - top) * 0.15)], fill=cc, width=max(1, int(tw * w * S * 0.06)))
    layer = layer.resize((w, h), Image.LANCZOS)
    la = np.asarray(layer).astype(np.float32) / 255
    alpha = la[..., 3:4]
    return a * (1 - alpha) + la[..., :3] * alpha


def ground(a, y0, rng, c_near, c_far, path=None):
    h, w = a.shape[:2]
    yy = np.linspace(0, 1, h)[:, None]
    t = np.clip((yy - y0) / (1 - y0), 0, 1)
    base = lerp(c_far[None, None, :], c_near[None, None, :], t[..., None])
    tex = fbm(h, w, 30, 5, rng)[..., None]
    tex2 = fbm(h, w, 8, 3, rng)[..., None]
    g = base * (0.75 + 0.4 * tex) * (0.85 + 0.3 * tex2)
    mask = (yy >= y0).astype(np.float32)
    mask = np.asarray(to_img(np.broadcast_to(mask, (h, w)).copy()).filter(ImageFilter.GaussianBlur(1.5))).astype(np.float32) / 255
    a = lerp(a, g, mask[..., None])
    if path is not None:
        xs = np.linspace(0, 1, w)[None, :]
        cx0, cx1, wid0, wid1, wig = path
        tt = t
        center = lerp(cx0, cx1, tt) + wig * np.sin(tt * 5.0) * tt
        width = lerp(wid0, wid1, tt ** 1.3)
        pm = np.clip(1 - np.abs(xs - center) / np.maximum(width, 1e-4), 0, 1)
        pm = np.clip(pm * 3, 0, 1) * (yy >= y0 + 0.01)
        ptex = fbm(h, w, 40, 4, rng)
        pc = col(170, 150, 120) * (0.8 + 0.35 * ptex[..., None])
        a = lerp(a, pc, pm[..., None] * 0.9)
    return a


# ----------------------------------------------------------------------------
# posters
# ----------------------------------------------------------------------------
def poster_mountain_forest(w, h, seed):
    rng = np.random.default_rng(seed)
    a = sky(h, w, col(120, 132, 140), col(190, 192, 188), rng, cloudiness=0.7, horizon_y=0.5)
    haze = col(165, 172, 175)
    xs = np.linspace(0, 1, w)
    r1 = 0.50 - 0.28 * ridged1d(w, 2, 6, rng)
    a = mountain_layer(a, r1, col(110, 118, 128), haze, 0.40, rng, snow=0.05)
    r2 = 0.56 - 0.14 * ridged1d(w, 3, 6, rng)
    a = mountain_layer(a, r2, col(80, 88, 92), haze, 0.25, rng, snow=0.03)
    a = draw_pines(a, rng, 180, (0.50, 0.62), (0.05, 0.10), col(35, 52, 40), col(70, 90, 70), haze, 0.35)
    a = ground(a, 0.60, rng, col(110, 112, 80), col(95, 105, 80), path=(0.48, 0.42, 0.01, 0.22, 0.06))
    a = draw_pines(a, rng, 14, (0.62, 0.80), (0.25, 0.42), col(25, 40, 30), col(55, 75, 55), x_range=(0.62, 1.0))
    a = draw_pines(a, rng, 8, (0.62, 0.75), (0.18, 0.30), col(25, 40, 30), col(55, 75, 55), x_range=(0.0, 0.25))
    a = finish_print(a, desat=0.2)
    return painterly(to_img(a), 1.0, rng)


def poster_tree_city(w, h, seed):
    rng = np.random.default_rng(seed)
    a = sky(h, w, col(110, 125, 150), col(200, 205, 205), rng, cloudiness=0.4, horizon_y=0.65)
    hz = col(175, 182, 188)
    # hazy city towers on the right
    S = 2
    layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = 0.42
    while x < 1.0:
        bw = rng.uniform(0.03, 0.07)
        bh = rng.uniform(0.15, 0.48)
        g = int(rng.uniform(140, 175))
        d.rectangle([x * w * S, (0.66 - bh) * h * S, (x + bw) * w * S, 0.70 * h * S], fill=(g, g + 3, g + 8, 255))
        if rng.random() < 0.3:
            d.rectangle([(x + bw * 0.4) * w * S, (0.66 - bh - 0.05) * h * S, (x + bw * 0.6) * w * S, (0.66 - bh) * h * S], fill=(g, g + 3, g + 8, 255))
        x += bw + rng.uniform(0.0, 0.03)
    layer = layer.resize((w, h), Image.LANCZOS)
    la = np.asarray(layer).astype(np.float32) / 255
    a = a * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
    a = ground(a, 0.68, rng, col(120, 120, 95), col(130, 135, 120), path=(0.62, 0.70, 0.02, 0.35, -0.08))
    a = draw_pines(a, rng, 30, (0.66, 0.72), (0.06, 0.12), col(60, 75, 65), col(90, 105, 90), hz, 0.4, x_range=(0.35, 1.0))
    # big tree(s) on the left
    a = draw_pines(a, rng, 2, (0.92, 0.97), (0.85, 0.95), col(22, 35, 28), col(45, 62, 48), x_range=(0.12, 0.30))
    a = draw_pines(a, rng, 3, (0.80, 0.88), (0.45, 0.60), col(28, 42, 32), col(55, 72, 56), x_range=(0.0, 0.12))
    a = finish_print(a, desat=0.15)
    return painterly(to_img(a), 1.0, rng)


def poster_hiker(w, h, seed):
    rng = np.random.default_rng(seed)
    a = sky(h, w, col(140, 150, 155), col(200, 200, 195), rng, cloudiness=0.8, horizon_y=0.4)
    hz = col(170, 175, 172)
    r = 0.40 - 0.22 * ridged1d(w, 3, 6, rng)
    a = mountain_layer(a, r, col(95, 105, 100), hz, 0.35, rng, snow=0.04)
    # cliff on the left
    cliff = 0.10 + 0.35 * np.clip((np.linspace(0, 1, w) - 0.0) / 0.5, 0, 1) ** 1.5 + 0.03 * fbm1d(w, 8, 4, rng)
    a = mountain_layer(a, np.clip(cliff, 0, 1), col(70, 78, 70), hz, 0.05, rng)
    a = draw_pines(a, rng, 40, (0.45, 0.70), (0.06, 0.14), col(30, 45, 35), col(60, 80, 60), hz, 0.15)
    a = ground(a, 0.70, rng, col(105, 100, 70), col(110, 115, 85), path=(0.5, 0.45, 0.02, 0.3, 0.05))
    # hiker figure
    S = 4
    layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx, by = 0.48 * w * S, 0.80 * h * S
    hh = 0.20 * h * S
    d.ellipse([cx - hh * 0.07, by - hh, cx + hh * 0.07, by - hh * 0.86], fill=(60, 45, 40, 255))
    d.polygon([(cx - hh * 0.12, by - hh * 0.86), (cx + hh * 0.12, by - hh * 0.86), (cx + hh * 0.10, by - hh * 0.45), (cx - hh * 0.10, by - hh * 0.45)], fill=(50, 60, 75, 255))
    d.rectangle([cx - hh * 0.14, by - hh * 0.84, cx + hh * 0.02, by - hh * 0.55], fill=(120, 60, 40, 255))
    d.polygon([(cx - hh * 0.09, by - hh * 0.45), (cx - hh * 0.01, by - hh * 0.45), (cx - hh * 0.05, by), (cx - hh * 0.12, by)], fill=(40, 40, 45, 255))
    d.polygon([(cx + hh * 0.01, by - hh * 0.45), (cx + hh * 0.09, by - hh * 0.45), (cx + hh * 0.13, by), (cx + hh * 0.06, by)], fill=(40, 40, 45, 255))
    layer = layer.resize((w, h), Image.LANCZOS)
    la = np.asarray(layer).astype(np.float32) / 255
    a = a * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
    a = finish_print(a, desat=0.2)
    return painterly(to_img(a), 1.0, rng)


def photo_print(w, h, seed, kind):
    rng = np.random.default_rng(seed)
    if kind == "lake":
        a = sky(h, w, col(130, 150, 170), col(210, 210, 205), rng, 0.5, 0.45)
        a = mountain_layer(a, 0.52 - 0.22 * ridged1d(w, 3, 5, rng), col(90, 100, 95), col(170, 175, 175), 0.3, rng, snow=0.03)
        yy = np.linspace(0, 1, h)[:, None, None]
        water = (yy > 0.55).astype(np.float32)
        a = lerp(a, np.flipud(a) * 0.8 + col(20, 30, 40), water * 0.85)
    elif kind == "building":
        a = sky(h, w, col(150, 160, 170), col(215, 215, 210), rng, 0.3, 0.5)
        S = 2
        layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.rectangle([0.2 * w * S, 0.25 * h * S, 0.8 * w * S, 0.85 * h * S], fill=(150, 120, 100, 255))
        for i in range(5):
            for j in range(4):
                x0 = (0.25 + i * 0.11) * w * S
                y0 = (0.32 + j * 0.13) * h * S
                d.rectangle([x0, y0, x0 + 0.06 * w * S, y0 + 0.07 * h * S], fill=(60, 65, 75, 255))
        layer = layer.resize((w, h), Image.LANCZOS)
        la = np.asarray(layer).astype(np.float32) / 255
        a = a * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
        a = ground(a, 0.85, rng, col(90, 95, 80), col(100, 105, 90))
    elif kind == "road":
        a = sky(h, w, col(120, 140, 160), col(205, 205, 200), rng, 0.6, 0.5)
        a = draw_pines(a, rng, 40, (0.5, 0.6), (0.1, 0.2), col(40, 55, 45), col(70, 85, 70))
        a = ground(a, 0.58, rng, col(95, 100, 80), col(110, 115, 95), path=(0.5, 0.5, 0.01, 0.4, 0.0))
    else:  # people / group snapshot
        a = sky(h, w, col(150, 160, 165), col(200, 200, 190), rng, 0.6, 0.6)
        a = ground(a, 0.62, rng, col(90, 105, 75), col(100, 110, 85))
        S = 2
        layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for i in range(4):
            cx = (0.2 + 0.2 * i + rng.uniform(-0.03, 0.03)) * w * S
            hh = rng.uniform(0.45, 0.55) * h * S
            by = 0.92 * h * S
            c = tuple(int(v) for v in rng.uniform(40, 160, 3)) + (255,)
            d.ellipse([cx - hh * 0.08, by - hh, cx + hh * 0.08, by - hh * 0.82], fill=(180, 140, 120, 255))
            d.rectangle([cx - hh * 0.13, by - hh * 0.82, cx + hh * 0.13, by - hh * 0.35], fill=c)
            d.rectangle([cx - hh * 0.11, by - hh * 0.35, cx + hh * 0.11, by], fill=(50, 55, 70, 255))
        layer = layer.resize((w, h), Image.LANCZOS)
        la = np.asarray(layer).astype(np.float32) / 255
        a = a * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
    a = finish_print(a, desat=0.15)
    img = to_img(a).filter(ImageFilter.GaussianBlur(0.6))
    # white photo border
    b = int(0.04 * min(w, h))
    canvas = Image.new("RGB", (w + 2 * b, h + 2 * b), (228, 226, 220))
    canvas.paste(img, (b, b))
    return canvas


# ----------------------------------------------------------------------------
# plaid flannel
# ----------------------------------------------------------------------------
def plaid(size, sett, rng, fuzz=0.06):
    """sett: list of (rgb, width_px). Symmetric sett mirrored; total must tile size."""
    seq = sett + sett[::-1]
    total = sum(wd for _, wd in seq)
    reps = max(1, round(size / total))
    scale = size / (total * reps)
    stripe = np.zeros((size, 3), np.float32)
    pos = 0.0
    for r in range(reps):
        for c, wd in seq:
            p0, p1 = int(round(pos)), int(round(pos + wd * scale))
            stripe[p0:p1] = col(*c)
            pos += wd * scale
    stripe[int(round(pos)):] = stripe[int(round(pos)) - 1]
    warp = stripe[None, :, :]
    weft = stripe[:, None, :]
    yy, xx = np.mgrid[0:size, 0:size]
    tw = (((xx + yy) // 2) % 4 < 2).astype(np.float32)[..., None]
    a = 0.5 * (warp + weft) + (tw - 0.5) * 0.35 * (warp - weft)
    # brushed flannel fuzz: soft, low contrast, tileable noise
    n = value_noise(size, size, 64, rng, tile=True)
    n2 = value_noise(size, size, 256, rng, tile=True)
    a = a * (1 - fuzz + fuzz * 2 * (0.6 * n + 0.4 * n2)[..., None])
    img = to_img(a).filter(ImageFilter.GaussianBlur(0.9))
    return img


# ----------------------------------------------------------------------------
# exterior backdrop
# ----------------------------------------------------------------------------
def canopy_layer(a, rng, n_trees, y_base, size, col_dark, col_light, haze_col, haze, x_range=(0, 1)):
    """Leafy deciduous canopies: clusters of soft blobs, lit from above-left,
    broken up by high-frequency leaf noise at the silhouette."""
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dens = np.zeros((h, w), np.float32)
    shade = np.zeros((h, w), np.float32)
    for _ in range(n_trees):
        cx = rng.uniform(*x_range) * w
        cy = rng.uniform(*y_base) * h
        r0 = rng.uniform(*size) * w
        for _ in range(9):
            bx = cx + rng.normal(0, r0 * 0.55)
            by = cy - abs(rng.normal(0, r0 * 0.6))
            br = r0 * rng.uniform(0.45, 0.8)
            d2 = ((xx - bx) ** 2 + ((yy - by) * 1.1) ** 2) / br ** 2
            blob = np.clip(1 - d2, 0, 1)
            light = np.clip(1 - ((xx - bx + br * 0.4) ** 2 + (yy - by + br * 0.5) ** 2) / (1.6 * br) ** 2, 0, 1)
            upd = blob > dens
            shade = np.where(upd, light, shade)
            dens = np.maximum(dens, blob)
        # trunk
        tw = max(2, int(r0 * 0.06))
        x0 = int(cx)
        dens[int(cy):h, max(0, x0 - tw):x0 + tw] = np.maximum(dens[int(cy):h, max(0, x0 - tw):x0 + tw], 0.9)
    leaf = fbm(h, w, 160, 4, rng)
    leaf2 = fbm(h, w, 40, 3, rng)
    m = np.clip((dens * 2.2 + (leaf - 0.5) * 1.6 * np.clip(dens * 5, 0, 1) - 0.35) * 3.0, 0, 1)
    c = lerp(col_dark, col_light, np.clip(shade * 0.8 + leaf2 * 0.5 + (leaf - 0.5) * 0.6, 0, 1)[..., None])
    c = lerp(c, haze_col, haze)
    return lerp(a, c, m[..., None])


def _clumps(d, pts, rng, c_dark, c_light, haze_col, haze, rmin, rmax, light_fn):
    for (x, y, t) in pts:
        r = rng.uniform(rmin, rmax)
        sh = np.clip(light_fn(x, y, t) + rng.normal(0, 0.18), 0, 1)
        c = lerp(c_dark, c_light, sh)
        c = lerp(c, haze_col, haze)
        cc = tuple(int(v * 255) for v in np.clip(c, 0, 1)) + (255,)
        d.ellipse([x - r, y - r * rng.uniform(0.6, 1.0), x + r, y + r * rng.uniform(0.6, 1.0)], fill=cc)


def conifer(d, cx, by, th, tw, rng, c_dark, c_light, haze_col, haze):
    """Feathery conifer: drooping branch tiers built from needle clumps."""
    top = by - th
    d.line([(cx, by), (cx, top + th * 0.05)], fill=tuple(int(v * 255) for v in lerp(c_dark * 0.6, haze_col, haze)) + (255,), width=max(2, int(tw * 0.05)))
    pts = []
    nb = int(th / 6) + 20
    for k in range(nb):
        hfrac = rng.uniform(0.02, 1.0)
        y0 = top + th * hfrac
        L = tw * 0.5 * (hfrac ** 0.85) * rng.uniform(0.6, 1.15)
        side = rng.choice([-1, 1])
        for m in range(14):
            u = m / 13
            x = cx + side * L * u
            y = y0 + L * 0.35 * u * u + rng.normal(0, tw * 0.01)
            pts.append((x, y, hfrac))
    for _ in range(int(th / 3)):
        hfrac = rng.uniform(0, 1)
        pts.append((cx + rng.normal(0, tw * 0.06 * hfrac), top + th * hfrac, hfrac))
    rng.shuffle(pts)
    _clumps(d, pts, rng, c_dark, c_light, haze_col, haze, tw * 0.018, tw * 0.04,
            lambda x, y, t: 0.65 - 0.5 * t + 0.25 * ((cx - x) / max(tw, 1)))


def broadleaf(d, cx, cy, rad, rng, c_dark, c_light, haze_col, haze):
    """Deciduous crown: lumpy envelope filled with leaf clumps, lit from top-left."""
    lobes = [(cx + rng.normal(0, rad * 0.45), cy + rng.normal(0, rad * 0.35), rad * rng.uniform(0.45, 0.75)) for _ in range(7)]
    pts = []
    for _ in range(int(rad * 9)):
        lx, ly, lr = lobes[rng.integers(len(lobes))]
        a = rng.uniform(0, 2 * np.pi)
        rr = lr * np.sqrt(rng.uniform(0, 1))
        pts.append((lx + rr * np.cos(a), ly + rr * np.sin(a) * 0.9, 0))
    pts.sort(key=lambda p: p[1])
    tw = tuple(int(v * 255) for v in lerp(c_dark * 0.5, haze_col, haze)) + (255,)
    d.line([(cx, cy), (cx + rng.normal(0, rad * 0.05), cy + rad * 2.5)], fill=tw, width=max(2, int(rad * 0.07)))
    _clumps(d, pts, rng, c_dark, c_light, haze_col, haze, rad * 0.04, rad * 0.09,
            lambda x, y, t: 0.55 - 0.45 * (y - cy) / rad - 0.2 * (x - cx) / rad)


def exterior(w, h, seed):
    """Overcast exterior backplate. Only the centre ~30% of the width is seen
    through the window, so the trees are composed for that window."""
    rng = np.random.default_rng(seed)
    a = sky(h, w, col(226, 231, 236), col(243, 244, 241), rng, cloudiness=0.45, horizon_y=0.75)
    hz = col(214, 218, 216)
    yy = np.arange(h)[:, None] / h
    ridge = 0.63 + 0.03 * fbm1d(w, 14, 6, rng)
    tl = np.clip((yy - ridge[None, :]) * 90, 0, 1)
    a = lerp(a, lerp(col(140, 152, 140), hz, 0.6), tl[..., None])
    S = 2
    layer = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    W2, H2 = w * S, h * S
    # mid-distance broadleaf crowns
    for _ in range(26):
        broadleaf(d, rng.uniform(0.25, 0.75) * W2, rng.uniform(0.63, 0.72) * H2, rng.uniform(0.022, 0.04) * W2, rng,
                  col(70, 88, 66), col(150, 162, 132), hz, 0.28)
    # conifers rising above the canopy
    for _ in range(9):
        conifer(d, rng.uniform(0.28, 0.72) * W2, rng.uniform(0.92, 1.0) * H2, rng.uniform(0.36, 0.47) * H2,
                rng.uniform(0.06, 0.09) * W2, rng, col(36, 52, 40), col(96, 114, 92), hz, 0.12)
    # near broadleaf crowns (lower, darker)
    for _ in range(10):
        broadleaf(d, rng.uniform(0.25, 0.75) * W2, rng.uniform(0.76, 0.86) * H2, rng.uniform(0.035, 0.055) * W2, rng,
                  col(48, 66, 46), col(125, 142, 108), hz, 0.08)
    layer = layer.resize((w, h), Image.LANCZOS)
    la = np.asarray(layer).astype(np.float32) / 255
    a = a * (1 - la[..., 3:4]) + la[..., :3] * la[..., 3:4]
    return to_img(a).filter(ImageFilter.GaussianBlur(1.0))


def main():
    poster_mountain_forest(900, 980, 11).save(os.path.join(OUT, "poster_mountain_forest.png"))
    poster_tree_city(1100, 910, 12).save(os.path.join(OUT, "poster_tree_city.png"))
    poster_hiker(520, 1100, 13).save(os.path.join(OUT, "poster_hiker.png"))
    poster_mountain_forest(560, 1000, 14).save(os.path.join(OUT, "poster_forest_tall.png"))
    for i, kind in enumerate(["lake", "building", "road", "people", "lake"]):
        photo_print(600, 410, 30 + i, kind).save(os.path.join(OUT, f"photo_{i}.png"))
    rng = np.random.default_rng(5)
    green = [((148, 154, 140), 40), ((38, 48, 40), 12), ((148, 154, 140), 14), ((92, 104, 88), 46),
             ((215, 210, 190), 10), ((92, 110, 88), 12), ((30, 36, 32), 26), ((190, 188, 170), 6)]
    plaid(1024, green, rng).save(os.path.join(OUT, "plaid_green.png"))
    grey = [((178, 178, 182), 40), ((56, 60, 68), 12), ((178, 178, 182), 12), ((122, 126, 136), 44),
            ((228, 228, 226), 10), ((122, 126, 136), 12), ((46, 50, 58), 24), ((205, 205, 210), 6)]
    plaid(1024, grey, rng).save(os.path.join(OUT, "plaid_grey.png"))
    exterior(2400, 1200, 21).save(os.path.join(OUT, "exterior.png"))
    print("textures written to", os.path.abspath(OUT))


if __name__ == "__main__":
    main()
