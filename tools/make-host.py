#!/usr/bin/env python3
"""Builds assets/images/host.webp, the girl on Home's banner: one row of frames (a film strip) that
app.css steps through (.hb-host).

How it was made (2026-11-13):
  1. 18 frames of the opening film (the first 12 are used), 15 a second from 10.43 s, cropped to her head and shoulders:
       ffmpeg -ss 10.43 -t 1.2 -i assets/video/launch.mp4 -vf "fps=15,crop=610:625:70:120" f%02d.png
  2. The frames laid 3 x 3 on two sheets, backgrounds removed in Runway (soft hair edge), saved as
     cut0.png and cut1.png next to the frames.
  3. python3 tools/make-host.py <that folder>

Here: the backdrop's brown is taken out of the hair's edge, the gap by her neck is filled, the bunny's
ears (they rise in front of her in the film) are covered with the first frame's shoulders, and the
bottom fades out. If the frame count or width changes, change --host-n and the size in app.css too.
"""
import sys, glob
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

D = sys.argv[1]
FW, FH, OUT_W, N = 610, 625, 260, 12
HAIR = np.array([40.0, 32.0, 30.0])            # her hair in shadow

def box(x, r=2):
    o = np.zeros_like(x); n = 0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o += np.roll(np.roll(x, dy, 0), dx, 1); n += 1
    return o / n

def clean(cut, orig):
    arr = np.array(cut).astype(float); rgb = arr[..., :3]; a = arr[..., 3] / 255
    orig = np.array(orig).astype(float)
    # holes inside her outline are filled with the frame's own dark pixels
    m = Image.fromarray(((a > 0.5) * 255).astype("uint8"))
    pad = Image.new("L", (m.width + 2, m.height + 2), 0); pad.paste(m, (1, 1)); ImageDraw.floodfill(pad, (0, 0), 128)
    hole = (np.array(pad)[1:-1, 1:-1] == 0)
    hole = np.array(Image.fromarray((hole * 255).astype("uint8")).filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(1.5))).astype(float) / 255
    lum = orig.mean(-1, keepdims=True) / 255
    w = (hole * (1 - a))[..., None]; rgb = rgb * (1 - w) + HAIR * (0.75 + lum) * w; a = np.maximum(a, hole)
    # the outline: smoothed (no lumps), pulled in a few pixels (the film blurs hair into the backdrop there) and made crisp
    blur = lambda x, r: np.array(Image.fromarray((x * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(r))).astype(float) / 255
    edge = np.clip((blur(a, 3.2) - 0.56) / 0.16, 0, 1); edge = edge * edge * (3 - 2 * edge)
    # pixels near the outline take the colour of the hair a little further in, so no backdrop brown is left on the rim
    deep = np.array(Image.fromarray((a * 255).astype("uint8")).filter(ImageFilter.MinFilter(13))).astype(float) / 255
    solid = deep > 0.98
    acc = np.where(solid[..., None], rgb, 0); wgt = solid.astype(float)
    for _ in range(12):
        acc = box(acc); wgt = box(wgt)
        acc = np.where(solid[..., None], rgb, acc); wgt = np.where(solid, 1.0, wgt)
    near = acc / np.maximum(wgt, 1e-4)[..., None]
    k = (1 - blur(deep, 2.0))[..., None] * (wgt > 0.02)[..., None]
    rgb = rgb * (1 - k) + near * k
    a = edge
    return np.dstack([rgb, a])

def fit(im):                                   # ffmpeg rounds the crop to an even height (624); the sheets use 625
    o = Image.new("RGB", (FW, FH)); o.paste(im, (0, 0)); return o
origs = [fit(Image.open(f).convert("RGB")) for f in sorted(glob.glob(D + "/f[0-9][0-9].png"))]
sheets = [Image.open(f"{D}/cut{k}.png").convert("RGBA") for k in range(2)]
frames = []
for n, o in enumerate(origs):
    c = sheets[n // 9].crop(((n % 9 % 3) * FW, (n % 9 // 3) * FH, (n % 9 % 3) * FW + FW, (n % 9 // 3) * FH + FH))
    frames.append(clean(c, o))

y = np.arange(FH)[:, None, None] / FH
low = np.clip((y - 0.72) / 0.08, 0, 1); low = low * low * (3 - 2 * low)            # below here: frame 0's shoulders
fade = np.clip((0.985 - y) / 0.13, 0, 1); fade = fade * fade * (3 - 2 * fade)      # the bottom fades out
frames = frames[:N]                             # after these she looks down at the bunny for good
out = []
for f in frames:
    g = f * (1 - low) + frames[0] * low
    g[..., 3:] *= fade
    m = Image.fromarray(((g[..., 3] > 0.05) * 255).astype("uint8")).copy(); ImageDraw.floodfill(m, (FW // 2, FH // 2), 128)
    g[..., 3] *= (np.array(m) == 128)             # loose specks of the backdrop go
    out.append(g)

alpha = np.max([g[..., 3] for g in out], 0)
ys, xs = np.where(alpha > 0.02); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
oh = round((y1 - y0) * OUT_W / (x1 - x0))
strip = Image.new("RGBA", (OUT_W * len(out), oh))
for n, g in enumerate(out):
    g = g.copy(); g[..., 3] *= 255
    im = Image.fromarray(g.clip(0, 255).astype("uint8"), "RGBA").crop((x0, y0, x1, y1)).resize((OUT_W, oh), Image.LANCZOS)
    strip.paste(im, (n * OUT_W, 0))
strip.save("assets/images/host.webp", quality=84, method=6)
print(len(out), "frames,", OUT_W, "x", oh, "each")
if len(sys.argv) > 2: strip.save(sys.argv[2])
