# -*- coding: utf-8 -*-
"""QA strips: vocal-stem spectrogram per line, with each character's onset.

    python tools/align_sheet.py [old.json] -> out/qa/align/line_XX.png
Red = source/lyrics.json (current), grey dashed = optional older file.
"""
import json, pathlib, sys
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
cur = json.loads((ROOT / "source/lyrics.json").read_text(encoding="utf-8"))["lines"]
old = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))["lines"] if len(sys.argv) > 1 else None
v, sr = sf.read(ROOT / "source/vocals.wav", dtype="float32", always_2d=True)
x = v.mean(1)
HOP, NFFT = sr // 200, 2048
win = np.hanning(NFFT).astype(np.float32)
OUT = ROOT / "out/qa/align"; OUT.mkdir(parents=True, exist_ok=True)
font = ImageFont.truetype("C:/Windows/Fonts/meiryo.ttc", 22)
PX = 400                                            # px per second
for L in cur:
    t0, t1 = L["t"] - 0.8, L["end"] + 0.6
    a, b = int(t0 * sr), int(t1 * sr)
    seg = x[max(0, a):b]
    n = 1 + (len(seg) - NFFT) // HOP
    idx = (np.arange(n) * HOP)[:, None] + np.arange(NFFT)[None, :]
    S = np.abs(np.fft.rfft(seg[idx] * win, axis=1))[:, : int(5000 * NFFT / sr)]
    S = np.log1p(S * 20); S = (S / (S.max() + 1e-9) * 255).astype(np.uint8)
    im = Image.fromarray(S.T[::-1]).convert("RGB").resize((int((t1 - t0) * PX), 300))
    W = im.width
    canvas = Image.new("RGB", (W, 420), (12, 12, 16)); canvas.paste(im, (0, 60))
    d = ImageDraw.Draw(canvas)
    X = lambda t: int((t - t0) * PX)
    if old:
        for u in old[L["i"]]["units"]:
            if u["sung"]:
                d.line([(X(u["t"]), 60), (X(u["t"]), 360)], fill=(140, 140, 140), width=1)
                d.text((X(u["t"]) + 2, 362), u["text"], font=font, fill=(150, 150, 150))
    for u in L["units"]:
        if u["sung"]:
            d.line([(X(u["t"]), 30), (X(u["t"]), 360)], fill=(255, 60, 60), width=2)
            d.text((X(u["t"]) + 3, 28), u["text"], font=font, fill=(255, 200, 80))
    s = t0 - t0 % 0.5
    while s < t1:
        d.text((X(s), 395), f"{s:.1f}", font=ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 14), fill=(120, 120, 120)); s += 0.5
    d.text((6, 2), f"{L['i']}  {L['jp']}", font=font, fill=(255, 255, 255))
    canvas.save(OUT / f"line_{L['i']:02d}.png")
print(OUT)
