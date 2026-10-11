# -*- coding: utf-8 -*-
"""Per-bar energy map of the song, on the sample-exact grid from grid.json.
Prints one row per bar: start time, total RMS, low / high band RMS, and an
onset-density figure, so section boundaries can be placed on bar lines.

Run:  python source/structure.py > source/bars.txt
"""
import json, pathlib, subprocess
import numpy as np

SRC = pathlib.Path(__file__).resolve().parent
g = json.loads((SRC / "grid.json").read_text())
SR, per, f0, dn = g["sr"], g["beat_period_samples"], g["first_beat_sample"], g["downbeat_index_offset"]

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(SRC / "music.flac"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, "<f4").astype(np.float64)


def band(sig, lo, hi):
    X = np.fft.rfft(sig)
    f = np.fft.rfftfreq(len(sig), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(sig))


# bars: beat k is a downbeat when (k - dn) % 4 == 0
k = dn
rows = []
while True:
    a = int(round(f0 + k * per)); b = int(round(f0 + (k + 4) * per))
    if b > len(x):
        break
    seg = x[a:b]
    lo = band(seg, 20, 180); hi = band(seg, 4000, 16000)
    db = lambda s: 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9)
    d = np.abs(np.diff(seg)); dens = (d > np.percentile(np.abs(np.diff(x)), 99.5)).mean() * 1000
    rows.append((len(rows), a / SR, db(seg), db(lo), db(hi), dens))
    k += 4

print(" bar   t0      rms    low    high   dens")
for n, t, r, l, h, d in rows:
    bar = "#" * max(0, int((r + 24) * 1.5))
    print(f"{n:4d} {t:7.2f}  {r:6.1f} {l:6.1f} {h:6.1f} {d:6.2f}  {bar}")
