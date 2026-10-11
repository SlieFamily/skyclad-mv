# -*- coding: utf-8 -*-
"""Per-frame audio features of the song -> src/aud.js

60 frames per second (works for both the 30 and 60 fps renders):
  rms, low (20-160 Hz), high (4-16 kHz), onset (spectral flux), all 0..255
  and 32 log-spaced bands (60 Hz - 14 kHz), 0..255.
The page reads them with aud(t) / band(t, k); so the CRT spectrum, kick
pulses and glows follow the actual record, not a guess.

Run:  python source/audio_feat.py
"""
import base64, json, pathlib, subprocess
import numpy as np

SRC = pathlib.Path(__file__).resolve().parent
ROOT = SRC.parent
SR, FPS = 48000, 60
HOP = SR // FPS                      # 800 samples
NFFT = 4096
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(SRC / "music.flac"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, "<f4").astype(np.float32)
n = len(x) // HOP + 1
xp = np.concatenate([np.zeros(NFFT // 2, np.float32), x, np.zeros(NFFT, np.float32)])
win = np.hanning(NFFT).astype(np.float32)
f = np.fft.rfftfreq(NFFT, 1 / SR)
edges = np.geomspace(60, 14000, 33)
bidx = [(f >= edges[i]) & (f < edges[i + 1]) for i in range(32)]
low_m, high_m = (f >= 20) & (f < 160), (f >= 4000) & (f < 16000)

bands = np.zeros((n, 32), np.float32)
low = np.zeros(n, np.float32); high = np.zeros(n, np.float32); rms = np.zeros(n, np.float32)
flux = np.zeros(n, np.float32)
prev = None
for s in range(0, n, 1000):
    e = min(n, s + 1000)
    idx = (np.arange(s, e) * HOP)[:, None] + np.arange(NFFT)[None, :]
    M = np.abs(np.fft.rfft(xp[idx] * win, axis=1)).astype(np.float32)
    P = M ** 2
    for i in range(32):
        bands[s:e, i] = P[:, bidx[i]].mean(1)
    low[s:e] = P[:, low_m].mean(1); high[s:e] = P[:, high_m].mean(1)
    L = np.log1p(M[:, (f > 100) & (f < 8000)] * 10)
    d = np.diff(np.concatenate([L[:1] if prev is None else prev[None], L]), axis=0)
    flux[s:e] = np.maximum(d, 0).sum(1)
    prev = L[-1]
    seg = xp[(np.arange(s, e) * HOP)[:, None] + np.arange(NFFT // 2 - HOP // 2, NFFT // 2 + HOP // 2)[None, :]]
    rms[s:e] = np.sqrt((seg ** 2).mean(1))


def to8(v, lo_pct=5, hi_pct=99.7, log=True):
    v = np.log10(v + 1e-12) if log else v
    lo, hi = np.percentile(v, lo_pct), np.percentile(v, hi_pct)
    return np.clip((v - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)


B = np.stack([to8(bands[:, i]) for i in range(32)], 1)
fl = flux / (np.percentile(flux, 99.5) + 1e-9)
cols = np.stack([to8(rms), to8(low), to8(high), np.clip(fl * 255, 0, 255).astype(np.uint8)], 1)
blob = np.concatenate([cols, B], 1).astype(np.uint8)          # n x 36
out = ROOT / "src" / "aud.js"
out.write_text("window.AUD = " + json.dumps({"fps": FPS, "n": int(n), "stride": 36,
                                             "b64": base64.b64encode(blob.tobytes()).decode()}) + ";\n")
print(out, n, "frames", f"{out.stat().st_size / 1024:.0f} KB")
