#!/usr/bin/env python3
"""Builds the girl on Home's banner (assets/host/): one base picture of her, cut out, and one strip of
face frames (eyes, brows and mouth only) that host-engine.js shows through a window over the base.

    python3 tools/make-host.py <folder>        (needs Pillow and numpy)

<folder> holds rest.png (the still Jose approved, on its flat pale backdrop) and one <name>.png per
face frame: an image edit of rest.png that changes only her face. The frame order is FRAMES below and
must be the same list as FRAMES in host-engine.js (tools/test-host-engine.cjs checks it).

How a frame is fitted: only what differs from rest.png inside the face window is kept, with a soft
edge; everything else in the frame IS rest.png, so her hair, outline and shoulders cannot shift between
frames. A frame whose edit changed her outside the window (she moved, or the chin dropped below it) is
refused: redo that edit. --check DIR also writes a picture per frame for looking at.

The pictures were made in Jose's Runway account (CREDITS.md). The source PNGs are not in the repo.
"""
import sys, os, json
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

FRAMES = ["rest", "half", "shut", "wink", "smile", "laugh", "love", "surprised", "sad", "worried",
          "lookL", "lookR", "lookU", "lookD"]
OUT_W = 480                       # her width in the saved base: three times the 160 px she is shown at
WIN = (300, 310, 726, 708)        # the face window in rest.png's own pixels (left, top, right, bottom)
EDGE = 14                         # the soft border inside the window where a frame fades back to rest.png
DRIFT = 0.012                     # most of the area outside the window that an edit may have changed

def box(x, r=1):
    o = np.zeros_like(x); n = 0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            o += np.roll(np.roll(x, dy, 0), dx, 1); n += 1
    return o / n

def key(im):
    """The flat backdrop out: what is joined to the border and close to its colour goes; her outline
    gets a part-way alpha and loses the backdrop's share of its colour."""
    c = np.array(im).astype(float); H, W, _ = c.shape
    bg = np.median(np.concatenate([c[:40, :40].reshape(-1, 3), c[:40, -40:].reshape(-1, 3)]), 0)
    d = np.sqrt(((c - bg) ** 2).sum(-1))
    m = Image.fromarray(((d < 16) * 255).astype("uint8")).copy()
    for xy in [(0, 0), (W - 1, 0), (0, H // 2), (W - 1, H // 2)]:
        if m.getpixel(xy) == 255: ImageDraw.floodfill(m, xy, 128)
    back = np.array(m) == 128
    fg = Image.fromarray((~back * 255).astype("uint8"))
    deep = np.array(fg.filter(ImageFilter.MinFilter(7))) > 0
    band = (np.array(fg.filter(ImageFilter.MaxFilter(5))) > 0) & ~deep
    acc = np.where(deep[..., None], c, 0); wgt = deep.astype(float)
    for _ in range(8):
        acc = box(acc); wgt = box(wgt)
        acc = np.where(deep[..., None], c, acc); wgt = np.where(deep, 1.0, wgt)
    near = acc / np.maximum(wgt, 1e-4)[..., None]
    span = np.maximum(np.sqrt(((near - bg) ** 2).sum(-1)), 24)
    a = np.where(deep, 1.0, np.where(band & (wgt > 0.01), np.clip(d / span, 0, 1), 0.0))
    a = np.array(Image.fromarray((a * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(0.6))).astype(float) / 255
    a = np.where(deep, 1.0, np.clip((a - 0.18) / 0.82, 0, 1))
    rgb = np.where(deep[..., None], c, np.where((wgt > 0.01)[..., None], near, c))
    return rgb, a

def changed(edit, rest):
    """Where an edit really differs from rest.png: the difference smoothed, so the grain every edit adds
    all over (and the reshuffled strands of her hair) does not count."""
    d = np.abs(edit - rest).sum(-1)
    d = np.array(Image.fromarray(np.clip(d, 0, 255).astype("uint8")).filter(ImageFilter.GaussianBlur(3))).astype(float)
    return d > 26

def blobs(mask, least):
    """The mask without its small islands (her earrings and stray strands, redrawn a little by every edit)."""
    im = Image.fromarray((mask * 255).astype("uint8")).copy(); keep = np.zeros(mask.shape, bool)
    for _ in range(400):
        ys, xs = np.where(np.array(im) == 255)
        if not len(ys): break
        ImageDraw.floodfill(im, (int(xs[0]), int(ys[0])), 128)
        one = np.array(im) == 128
        if one.sum() >= least: keep |= one
        im.paste(0, mask=Image.fromarray((one * 255).astype("uint8")))
    return keep

def fit(edit, rest):
    """The frame: rest.png everywhere, the edit where it changed her face, a soft edge between."""
    H, W, _ = rest.shape; x0, y0, x1, y1 = WIN
    ch = changed(edit, rest)
    inside = np.zeros((H, W), bool); inside[y0 + EDGE:y1 - EDGE, x0 + EDGE:x1 - EDGE] = True
    outside = np.ones((H, W), bool); outside[y0:y1, x0:x1] = False
    m = Image.fromarray((blobs(ch & inside, 500) * 255).astype("uint8"))
    m = m.filter(ImageFilter.MaxFilter(21)).filter(ImageFilter.GaussianBlur(5))
    lim = np.zeros((H, W)); lim[y0:y1, x0:x1] = 1
    lim = np.array(Image.fromarray((lim * 255).astype("uint8")).filter(ImageFilter.GaussianBlur(EDGE / 2.5))).astype(float) / 255
    a = np.minimum(np.array(m).astype(float) / 255, np.clip((lim - 0.5) * 2, 0, 1)); a[outside] = 0   # none of the edit on the window's rim
    return rest * (1 - a[..., None]) + edit * a[..., None], a, float((ch & outside).mean()), int((ch & ~inside & ~outside).sum())

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src = args[0]
    check = sys.argv[sys.argv.index("--check") + 1] if "--check" in sys.argv else None
    rest_im = Image.open(os.path.join(src, "rest.png")).convert("RGB")
    rest = np.array(rest_im).astype(float)
    rgb, alpha = key(rest_im)
    ys, xs = np.where(alpha > 0.02); bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out_h = round((by1 - by0) * OUT_W / (bx1 - bx0)); k = OUT_W / (bx1 - bx0)
    # the window in the saved base's pixels, on a 3 px grid so it lands on whole pixels at 160 px wide
    wx0, wy0 = [int(round((v - o) * k / 3)) * 3 for v, o in ((WIN[0], bx0), (WIN[1], by0))]
    wx1, wy1 = [int(round((v - o) * k / 3)) * 3 for v, o in ((WIN[2], bx0), (WIN[3], by0))]
    fw, fh = wx1 - wx0, wy1 - wy0
    assert alpha[WIN[1]:WIN[3], WIN[0]:WIN[2]].min() == 1, "the face window must lie wholly inside her"

    def small(a):                                               # the same cut and the same shrink for every picture
        return Image.fromarray(a.clip(0, 255).astype("uint8")).crop((bx0, by0, bx1, by1)).resize((OUT_W, out_h), Image.LANCZOS)

    os.makedirs("assets/host", exist_ok=True)
    base = small(rgb); base.putalpha(small(alpha * 255).convert("L"))
    names = [n for n in FRAMES if os.path.exists(os.path.join(src, n + ".png"))]
    missing = [n for n in FRAMES if n not in names]
    if missing and "--partial" not in sys.argv: sys.exit("missing frames: " + ", ".join(missing))
    strip = Image.new("RGB", (fw * len(FRAMES), fh)); bad = []
    for i, n in enumerate(FRAMES):                              # --partial: a missing frame shows rest.png
        edit = np.array(Image.open(os.path.join(src, (n if n in names else "rest") + ".png")).convert("RGB").resize(rest_im.size)).astype(float)
        if n == "rest" or n not in names: frame, a, drift, rim = rest, np.zeros(rest.shape[:2]), 0.0, 0
        else: frame, a, drift, rim = fit(edit, rest)
        ok = drift <= DRIFT and rim < 900
        print(f"{n:10s} changed outside the window: {drift * 100:5.2f}%   on its rim: {rim:5d} px   {'ok' if ok else 'REDO'}")
        if not ok: bad.append(n)
        strip.paste(small(frame).crop((wx0, wy0, wx1, wy1)), (i * fw, 0))
        if check:
            os.makedirs(check, exist_ok=True)
            whole = small(frame).convert("RGBA"); whole.putalpha(base.getchannel("A")); whole.save(os.path.join(check, n + ".png"))
            Image.fromarray((a * 255).astype("uint8")).crop((WIN[0] - 20, WIN[1] - 20, WIN[2] + 20, WIN[3] + 20)).save(os.path.join(check, n + "-mask.png"))
    base.save("assets/host/base.webp", quality=84, method=6)
    strip.save("assets/host/face.webp", quality=86, method=6)
    meta = {"frames": FRAMES, "missing": missing, "base": [OUT_W, out_h], "window": [wx0, wy0, fw, fh]}
    print(json.dumps(meta))
    print("base", os.path.getsize("assets/host/base.webp") // 1024, "KB, face strip", os.path.getsize("assets/host/face.webp") // 1024, "KB")
    if bad: sys.exit("redo: " + ", ".join(bad))

main()
