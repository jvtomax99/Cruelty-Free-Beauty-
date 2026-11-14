#!/usr/bin/env python3
"""Cuts a music take into the app's endless loop (assets/sounds/music.mp3).

  python3 tools/make-music-loop.py TAKE.mp3 [OUT.mp3] [--seam SEAM.mp3]

Needs ffmpeg and numpy. The take is not in the repo (see CREDITS.md).

How: it looks for two moments in the take, 45 s or more apart, where the music is doing the same thing
(the same sounds for three seconds either side), lines them up to the sample, and cuts from one to the
other. The last third of a second of the cut fades into what the take played just before the cut's
start, so the end runs into the start with nothing to hear. The file then carries PAD seconds of the
loop's end before it and PAD seconds of its start after it: music.js loops a stretch of exactly LOOP
seconds inside that, so the silence an MP3 has at its start can never land in the loop.

It prints LOOP: put that number in music.js. --seam also writes the last and first 8 s joined, to
hear the join.
"""
import subprocess, sys
import numpy as np

SR = 44100
PAD = 0.5          # the same number as PAD in music.js
FADE = 0.35        # seconds of the end that blend into the lead-up to the start
LOUD = -20.0       # LUFS: quiet enough to sit under the app
MIN_LOOP, EDGE_IN, EDGE_OUT = 45.0, 6.0, 5.0   # the shortest loop; how much of the take's start and end to keep out


def read(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)


def write(path, x, gain_db=0.0):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-",
                    "-af", f"volume={gain_db:.2f}dB", "-map_metadata", "-1", "-c:a", "libmp3lame", "-b:a", "128k", path],
                   input=x.astype(np.float32).tobytes(), check=True)


def loudness(x):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-",
                          "-af", "ebur128=peak=true", "-f", "null", "-"],
                         input=x.astype(np.float32).tobytes(), capture_output=True).stderr.decode()
    tail = out[out.rindex("Summary:"):]
    val = lambda key: float(tail.split(key)[1].split()[0])
    return val("I:"), val("Peak:")


def features(mono, hop):
    """One row per hop: how loud each of 48 pitch bands is (log), with the average taken out."""
    n = 4096
    win = np.hanning(n)
    count = (len(mono) - n) // hop
    edges = np.geomspace(55, 12000, 49) * n / SR
    rows = np.empty((count, 48))
    for i in range(count):
        mag = np.abs(np.fft.rfft(mono[i * hop:i * hop + n] * win))
        rows[i] = [mag[int(a):max(int(b), int(a) + 1)].mean() for a, b in zip(edges[:-1], edges[1:])]
    rows = np.log1p(rows * 50)
    rows -= rows.mean(axis=0)
    rows /= np.linalg.norm(rows, axis=1, keepdims=True) + 1e-9
    return rows


def find(mono):
    hop = 2048                                    # 46 ms
    per = SR / hop
    f = features(mono, hop)
    n = len(f)
    dist = 1 - f @ f.T                            # 0 where two moments sound alike
    half = int(3 * per)
    best = None
    for lag in range(int(MIN_LOOP * per), n - int((EDGE_IN + EDGE_OUT) * per)):
        d = np.diagonal(dist, lag)                # d[i] = moment i against moment i + lag
        c = np.concatenate([[0], np.cumsum(d)])
        lo, hi = int(EDGE_IN * per), len(d) - int(EDGE_OUT * per)
        if hi - lo < 1:
            continue
        i = np.arange(lo, hi)
        cost = (c[i + half] - c[i - half]) / (2 * half)
        k = int(np.argmin(cost))
        score = cost[k] - 0.0004 * lag / per       # between two equally good joins, the longer loop
        if best is None or score < best[0]:
            best = (score, cost[k], i[k] * hop + 2048, lag * hop)
    _, cost, a, length = best
    return a, length, cost


def align(mono, a, length):
    """Moves the loop's end by up to 60 ms so the two waveforms sit on top of each other."""
    w, reach = SR // 2, int(0.06 * SR)
    ref = mono[a - w:a + w]
    best, at = -2, 0
    for s in range(-reach, reach + 1):
        seg = mono[a + length + s - w:a + length + s + w]
        r = float(ref @ seg) / (np.linalg.norm(ref) * np.linalg.norm(seg) + 1e-9)
        if r > best:
            best, at = r, s
    return length + at, best


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    seam = sys.argv[sys.argv.index("--seam") + 1] if "--seam" in sys.argv else None
    if seam:
        args.remove(seam)
    if not args:
        sys.exit(__doc__)
    src, out = args[0], args[1] if len(args) > 1 else "assets/sounds/music.mp3"
    x = read(src)
    mono = x.mean(axis=1)
    a, length, cost = find(mono)
    length, match = align(mono, a, length)
    loop = x[a:a + length].copy()
    k = int(FADE * SR)
    up = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, k)))[:, None]
    loop[-k:] = loop[-k:] * (1 - up) + x[a - k:a] * up
    pad = int(PAD * SR)
    whole = np.concatenate([loop[-pad:], loop, loop[:pad]])
    level, peak = loudness(loop)
    gain = min(LOUD - level, -1.0 - peak)
    write(out, whole, gain)
    if seam:
        s = 8 * SR
        write(seam, np.concatenate([loop[-s:], loop[:s]]), gain)
    print(f"take {len(x) / SR:.2f} s; loop from {a / SR:.3f} s to {(a + length) / SR:.3f} s")
    print(f"join: sounds differ by {cost:.3f} (0 = the same, 1 = unrelated); waveforms match {match:.2f} (1 = the same)")
    print(f"loudness {level:.1f} LUFS, changed by {gain:+.1f} dB")
    print(f"LOOP = {length / SR:.6f}   (PAD = {PAD})")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
