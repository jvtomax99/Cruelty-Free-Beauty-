#!/usr/bin/env python3
"""Builds assets/images/host.webp, the girl on Home's banner: one row of frames (a film strip) that
app.css steps through (.hb-host).

How it was made (2026-11-13), all in Jose's Runway account:
  1. A still of the opening film's girl redrawn on a flat pale blue-grey backdrop (one film frame as the
     reference), so her hair has a clean outline.
  2. That still animated for 4 s, starting and ending on it, so the clip loops.
  3. python3 tools/make-host.py clip.mp4      (needs ffmpeg, Pillow, numpy)

Here the flat backdrop is keyed out: everything joined to the picture's border and close to the backdrop's
colour goes; pixels on her outline get a part-way alpha and lose the backdrop's share of their colour.
If FPS, the frame count or the size changes, change --host-n, the aspect ratio and the timing in app.css.
"""
import sys, glob, os, subprocess, tempfile
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

CLIP = sys.argv[1]
FPS, OUT_W = 10, 240

def box(x, r=1):
    o = np.zeros_like(x); n = 0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o += np.roll(np.roll(x, dy, 0), dx, 1); n += 1
    return o / n

def key(im):
    c = np.array(im).astype(float); H, W, _ = c.shape
    bg = np.median(np.concatenate([c[:40, :40].reshape(-1, 3), c[:40, -40:].reshape(-1, 3)]), 0)
    d = np.sqrt(((c - bg) ** 2).sum(-1))
    m = Image.fromarray(((d < 16) * 255).astype("uint8")).copy()          # close to the backdrop...
    for xy in [(0, 0), (W - 1, 0), (0, H // 2), (W - 1, H // 2)]:
        if m.getpixel(xy) == 255: ImageDraw.floodfill(m, xy, 128)        # ...and joined to the border
    back = np.array(m) == 128
    fg = Image.fromarray((~back * 255).astype("uint8"))
    deep = np.array(fg.filter(ImageFilter.MinFilter(7))) > 0             # well inside her
    band = (np.array(fg.filter(ImageFilter.MaxFilter(5))) > 0) & ~deep   # her outline
    acc = np.where(deep[..., None], c, 0); wgt = deep.astype(float)       # her own colour, spread out to the outline
    for _ in range(8):
        acc = box(acc); wgt = box(wgt)
        acc = np.where(deep[..., None], c, acc); wgt = np.where(deep, 1.0, wgt)
    near = acc / np.maximum(wgt, 1e-4)[..., None]
    span = np.maximum(np.sqrt(((near - bg) ** 2).sum(-1)), 24)
    a = np.where(deep, 1.0, np.where(band & (wgt > 0.01), np.clip(d / span, 0, 1), 0.0))
    a = np.array(Image.fromarray((a * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.6))).astype(float) / 255
    a = np.where(deep, 1.0, np.clip((a - 0.18) / 0.82, 0, 1))             # no faint haze outside the outline
    rgb = np.where(deep[..., None], c, np.where((wgt > 0.01)[..., None], near, c))
    return np.dstack([rgb, a])

tmp = tempfile.mkdtemp()
subprocess.run(["ffmpeg", "-v", "error", "-i", CLIP, "-vf", f"fps={FPS}", f"{tmp}/f%03d.png"], check=True)
files = sorted(glob.glob(tmp + "/f*.png"))[:-1]                           # the last frame repeats the first
out = [key(Image.open(f).convert("RGB")) for f in files]
alpha = np.max([g[..., 3] for g in out], 0)
ys, xs = np.where(alpha > 0.02); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
oh = round((y1 - y0) * OUT_W / (x1 - x0))
strip = Image.new("RGBA", (OUT_W * len(out), oh))
for n, g in enumerate(out):
    g = g.copy(); g[..., 3] *= 255
    im = Image.fromarray(g.clip(0, 255).astype("uint8"), "RGBA").crop((x0, y0, x1, y1)).resize((OUT_W, oh), Image.LANCZOS)
    strip.paste(im, (n * OUT_W, 0))
strip.save("assets/images/host.webp", quality=78, method=6)
print(len(out), "frames,", OUT_W, "x", oh, "each,", os.path.getsize("assets/images/host.webp") // 1024, "KB")
if len(sys.argv) > 2: strip.save(sys.argv[2])
