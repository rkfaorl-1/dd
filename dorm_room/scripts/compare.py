"""Side-by-side, 50% overlay and edge-overlay comparison of a render vs the reference.

Usage: python compare.py <reference.png> <render.png> <out_prefix>
"""
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ref_p, ren_p, out = sys.argv[1:4]
ref = Image.open(ref_p).convert("RGB")
ren = Image.open(ren_p).convert("RGB").resize(ref.size, Image.LANCZOS)

# side by side
sbs = Image.new("RGB", (ref.width * 2 + 10, ref.height), (0, 0, 0))
sbs.paste(ref, (0, 0))
sbs.paste(ren, (ref.width + 10, 0))
sbs.save(out + "_sbs.png")

# 50/50 blend
Image.blend(ref, ren, 0.5).save(out + "_blend.png")

# edge overlay: reference edges red, render edges cyan
def edges(im):
    e = im.convert("L").filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.FIND_EDGES)
    a = np.asarray(e).astype(np.float32)
    return np.clip(a / max(1.0, np.percentile(a, 97)) , 0, 1)

er, en = edges(ref), edges(ren)
base = np.asarray(ImageOps.grayscale(ref).convert("RGB")).astype(np.float32) * 0.35
base[..., 0] = np.maximum(base[..., 0], er * 255)
base[..., 1] = np.maximum(base[..., 1], en * 255)
base[..., 2] = np.maximum(base[..., 2], en * 255)
Image.fromarray(base.astype(np.uint8)).save(out + "_edges.png")

# tonal statistics
r = np.asarray(ref).astype(np.float32)
n = np.asarray(ren).astype(np.float32)
print("mean ref", r.reshape(-1, 3).mean(0).round(1), "render", n.reshape(-1, 3).mean(0).round(1))
print("std  ref", r.std().round(1), "render", n.std().round(1))
# region means on a 4x4 grid (luma)
lr, ln = r.mean(2), n.mean(2)
H, W = lr.shape
print("luma grid (ref/render):")
for j in range(4):
    row = []
    for i in range(4):
        a = lr[j * H // 4:(j + 1) * H // 4, i * W // 4:(i + 1) * W // 4].mean()
        b = ln[j * H // 4:(j + 1) * H // 4, i * W // 4:(i + 1) * W // 4].mean()
        row.append(f"{a:5.0f}/{b:5.0f}")
    print("  " + "  ".join(row))
