# -*- coding: utf-8 -*-
"""Find the exact repeat offsets of the song's sections (in beats), so the
lyric aligner can pool vocal-onset evidence across repeats of the same melody.

Per-beat chroma of the full mix (harmony repeats) + per-beat vocal-flux
pattern (rhythm repeats). For each repeat, search the beat offset around the
expected one that maximises both. Writes source/form.json.

Run:  python source/form.py
"""
import json, pathlib, subprocess
import numpy as np

SRC = pathlib.Path(__file__).resolve().parent
g = json.loads((SRC / "grid.json").read_text())
SR, PER, F0 = g["sr"], g["beat_period_samples"], g["first_beat_sample"]
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(SRC / "music.flac"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, "<f4").astype(np.float32)
NFFT, HOP = 8192, 2400
nfr = 1 + (len(x) - NFFT) // HOP
f = np.fft.rfftfreq(NFFT, 1 / SR)
keep = (f > 60) & (f < 2000)
pc = (np.round(12 * np.log2(f[keep] / 440.0)) % 12).astype(int)
win = np.hanning(NFFT).astype(np.float32)
chroma = np.zeros((nfr, 12), np.float32)
for s in range(0, nfr, 400):
    e = min(nfr, s + 400)
    idx = (np.arange(s, e) * HOP)[:, None] + np.arange(NFFT)[None, :]
    M = np.abs(np.fft.rfft(x[idx] * win, axis=1))[:, keep]
    for p in range(12):
        chroma[s:e, p] = M[:, pc == p].sum(1)
tfr = (np.arange(nfr) * HOP + NFFT / 2) / SR
nb = int((len(x) - F0) / PER)
bt = (F0 + np.arange(nb + 1) * PER) / SR
cb = np.zeros((nb, 12))
for k in range(nb):
    m = (tfr >= bt[k]) & (tfr < bt[k + 1])
    if m.any():
        cb[k] = chroma[m].mean(0)
cb = np.log1p(cb); cb -= cb.mean(1, keepdims=True)
cb /= np.linalg.norm(cb, axis=1, keepdims=True) + 1e-9

# sections in beats (bar = 4 beats, bar 0 at beat 0)
SECT = {"V1": (72, 168), "C1": (168, 252)}
SEARCH = {"V2": ("V1", 240, 10), "C2": ("C1", 240, 10), "CF": ("C1", 410, 14)}
form = {"sections": dict(SECT), "repeats": {}}
for name, (ref, guess, rad) in SEARCH.items():
    a, b = SECT[ref]
    best = None
    for D in range(guess - rad, guess + rad + 1):
        if b + D > nb:
            continue
        s = float(np.mean(np.sum(cb[a:b] * cb[a + D:b + D], 1)))
        if best is None or s > best[1]:
            best = (D, s)
        print(f"  {name} vs {ref}  D={D:4d}  chroma sim {s:+.3f}")
    form["repeats"][name] = {"of": ref, "offset_beats": best[0], "sim": round(best[1], 3)}
    form["sections"][name] = (a + best[0], b + best[0])
    print(f"{name}: offset {best[0]} beats ({best[0] / 4:.2f} bars)  sim {best[1]:.3f}")
(SRC / "form.json").write_text(json.dumps(form, indent=1), encoding="utf-8")
