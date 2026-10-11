# -*- coding: utf-8 -*-
"""Measure the song's tempo grid to the sample.

The generic tracker is too noisy for sample-level sync, so: build a spectral-flux
onset envelope at 1 ms resolution, then grid-search (period, phase) of a beat
comb that maximises onset energy on the beats. Constant-tempo studio tracks give
one sharp peak. Writes source/grid.json with the beat period in SAMPLES.

Frame/audio contract used by the film:  48000 Hz, 30 fps  ->  exactly 1600 samples
per frame. Every musical time in the film is an integer sample index.

Run:  python source/tempo.py
"""
import json, pathlib, subprocess
import numpy as np

SRC = pathlib.Path(__file__).resolve().parent
SR = 48000

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(SRC / "music.flac"), "-ac", "1",
                      "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, dtype="<f4").astype(np.float64)
N = len(x)

# ---- spectral flux onset envelope, hop 1 ms --------------------------------
HOP, WIN = 48, 1024
nfr = (N - WIN) // HOP
win = np.hanning(WIN)
idx = np.arange(WIN)[None, :] + HOP * np.arange(nfr)[:, None]
env = np.zeros(nfr)
prev = None
CH = 4000
for s in range(0, nfr, CH):
    fr = x[idx[s:s + CH]] * win
    mag = np.log1p(40 * np.abs(np.fft.rfft(fr, axis=1)))
    if prev is not None:
        d = np.diff(np.vstack([prev[None], mag]), axis=0)
    else:
        d = np.vstack([np.zeros((1, mag.shape[1])), np.diff(mag, axis=0)])
    env[s:s + len(fr)] = np.maximum(d, 0).sum(1)
    prev = mag[-1]
env -= np.convolve(env, np.ones(200) / 200, mode="same")   # local mean removal
env = np.maximum(env, 0)
t_env = (np.arange(nfr) * HOP + WIN / 2) / SR

# analyse only the steady, full-band part of the song
mask = (t_env > 26) & (t_env < 262)


def score(period_s, phase_s):
    k0 = np.ceil((26 - phase_s) / period_s); k1 = np.floor((262 - phase_s) / period_s)
    bt = phase_s + period_s * np.arange(k0, k1 + 1)
    j = np.round((bt * SR - WIN / 2) / HOP).astype(int)
    j = j[(j >= 2) & (j < nfr - 2)]
    return (env[j] + 0.5 * (env[j - 1] + env[j + 1])).mean()


# coarse: bpm 160..172, then fine
best = (0, 0, 0)
for bpm in np.arange(160, 172, 0.02):
    per = 60 / bpm
    for ph in np.arange(0, per, 0.004):
        s = score(per, ph)
        if s > best[0]:
            best = (s, per, ph)
_, per, ph = best
for _ in range(3):
    cand = []
    for dp in np.linspace(-0.0004, 0.0004, 81):
        for dph in np.linspace(-0.004, 0.004, 33):
            cand.append((score(per + dp, ph + dph), per + dp, ph + dph))
    _, per, ph = max(cand)

bpm = 60 / per
# strength of the winner vs. off-beat comb (sanity: should be clearly larger)
ratio = score(per, ph) / max(1e-9, score(per, ph + per / 2))

# which beat is the downbeat? pick the phase of 4 with the most low-band energy
lo = np.convolve(np.abs(x), np.ones(480) / 480, mode="same")[::HOP][:nfr]
bars = []
for k in range(4):
    bt = ph + per * (k + 4 * np.arange(int(30 / (4 * per)), int(260 / (4 * per))))
    j = np.round(bt * SR / HOP).astype(int); j = j[j < nfr]
    bars.append(env[j].mean())
down = int(np.argmax(bars))

beat0 = ph % per
first_beat_sample = int(round(beat0 * SR))
period_samples = per * SR

doc = {
    "sr": SR, "fps": 30, "samples_per_frame": SR // 30,
    "bpm": round(bpm, 4),
    "beat_period_samples": round(period_samples, 3),
    "first_beat_sample": first_beat_sample,
    "downbeat_index_offset": down,   # beat k is a downbeat when (k - down) % 4 == 0
    "onbeat_vs_offbeat": round(ratio, 3),
    "duration_samples": N,
}
(SRC / "grid.json").write_text(json.dumps(doc, indent=1), encoding="utf-8")
print(json.dumps(doc, indent=1))
print(f"bar strengths by phase: {[round(b, 3) for b in bars]}")
