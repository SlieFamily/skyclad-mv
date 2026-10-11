# -*- coding: utf-8 -*-
"""Per-character onsets from the singer's voice  ->  source/lyrics.json

1. vocals.wav (Demucs stem, vocals.py) is resampled to 16 kHz.
2. torchaudio MMS_FA (wav2vec2 CTC, multilingual romanised alphabet) gives
   frame-level token posteriors, 20 ms per frame.
3. Each line's kana readings (readings.py, via lines.json) become romaji, one
   token run per displayed character; a star token on both sides soaks up
   the neighbouring lines and silence. Viterbi forced alignment puts every
   character on the frame its first sound is sung.
4. Onsets are snapped to the nearest vocal-stem spectral-flux peak (+-60 ms),
   kept monotonic.
A unit's `t` is when it appears on screen; `end` is when the voice of the
last mora decays. The film holds a line until the next line's first `t`.

Run:  python source/vocals.py && python source/align_ctc.py
      (needs requirements-align.txt; TORCH_HOME picks the model cache)
"""
import json, pathlib, sys
import numpy as np
import soundfile as sf
import torch, torchaudio
import torchaudio.functional as AF

SRC = pathlib.Path(__file__).resolve().parent
lines = json.loads((SRC / "lines.json").read_text(encoding="utf-8"))

# ---------------------------------------------------------------- kana -> romaji
BASE = dict(zip(
    "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
    "がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ",
    "a i u e o ka ki ku ke ko sa shi su se so ta chi tsu te to na ni nu ne no ha hi fu he ho "
    "ma mi mu me mo ya yu yo ra ri ru re ro wa o n "
    "ga gi gu ge go za ji zu ze zo da ji zu de do ba bi bu be bo pa pi pu pe po".split()))
SMALL_Y = {"ゃ": "a", "ゅ": "u", "ょ": "o"}
SMALL_V = {"ぁ": "a", "ぃ": "i", "ぅ": "u", "ぇ": "e", "ぉ": "o"}
kata2hira = lambda s: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def romaji(kana, prev_vowel="a", next_cons=""):
    """romaji of one unit's reading. っ takes the next unit's consonant, ー the
    previous vowel; small ゃゅょ fuse with the preceding kana."""
    s = kata2hira(kana)
    out = ""
    i = 0
    while i < len(s):
        c = s[i]
        if c == "ー":
            out += (out[-1] if out and out[-1] in "aeiou" else prev_vowel)
        elif c == "っ":
            nxt = BASE.get(s[i + 1], "") if i + 1 < len(s) else next_cons
            out += (nxt[:1] if nxt else "t")
        elif c in SMALL_Y and out:
            if out.endswith(("shi", "chi")) or out[-2:] == "ji" or out.endswith("ji"):
                out = out[:-1] + SMALL_Y[c]
            else:
                out = out[:-1] + "y" + SMALL_Y[c]
        elif c in SMALL_V and out:
            out = out[:-1] + SMALL_V[c] if out[-1] in "aeiou" else out + SMALL_V[c]
        elif c in BASE:
            out += BASE[c]
        i += 1
    return out


def unit_romaji(L):
    """one token string per unit ('' = not sung), Japanese particles read as sung."""
    us = L["units"]
    raw = []
    for k, u in enumerate(us):
        r = u["read"]
        if u["text"] == " " or r in ("_", ""):
            raw.append("")
        elif r.isdigit():                              # latin word
            raw.append("".join(ch for ch in u["text"].lower() if ch.isalpha()))
        elif u["text"] == "は" and r == "は" and k > 0:
            raw.append("wa")
        elif u["text"] == "へ" and r == "へ" and k > 0 and us[k - 1]["read"] not in ("_",) and u is not us[0]:
            raw.append("e")
        elif u["text"] == "を":
            raw.append("o")
        else:
            raw.append(None)                           # fill below (needs neighbours)
    for k, u in enumerate(us):
        if raw[k] is not None:
            continue
        pv = next((raw[q] for q in range(k - 1, -1, -1) if raw[q]), "a")
        nk = next((us[q]["read"] for q in range(k + 1, len(us)) if raw[q] != ""), "")
        nc = BASE.get(kata2hira(nk)[:1], "") if nk and not nk.isdigit() else ""
        raw[k] = romaji(u["read"], pv[-1] if pv and pv[-1] in "aeiou" else "a", nc)
    return raw

# ---------------------------------------------------------------- audio + emissions
SR16 = 16000
v, sr = sf.read(SRC / "vocals.wav", dtype="float32", always_2d=True)
mono = torch.from_numpy(v.mean(1))
w16 = torchaudio.functional.resample(mono, sr, SR16)
w16 = w16 / (w16.abs().max() + 1e-9) * 0.9

bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model(with_star=True).eval()
DICT = bundle.get_dict(star="*")
STAR, BLANK = DICT["*"], DICT["-"]

CH, CTX = 20 * SR16, 2 * SR16                          # 20 s chunks with 2 s context each side
FR = 0.02                                              # seconds per emission frame (wav2vec2 stride 320)
nfr = int(len(w16) / 320)
EM = None
with torch.inference_mode():
    for s in range(0, len(w16), CH):
        a, b = max(0, s - CTX), min(len(w16), s + CH + CTX)
        e, _ = model(w16[a:b][None])
        e = torch.log_softmax(e[0], -1)
        if EM is None:
            EM = torch.full((nfr + 2, e.shape[1]), float("nan"))
        f0 = (s - a) // 320
        n = min(CH // 320, e.shape[0] - f0, EM.shape[0] - s // 320)
        EM[s // 320: s // 320 + n] = e[f0:f0 + n]
        print(f"emissions {b / SR16:6.1f}s", file=sys.stderr, end="\r")
EM = EM[:nfr]
EM = torch.nan_to_num(EM, nan=-30.0)

# ---------------------------------------------------------------- vocal onset envelope (10 ms)
HOP, NFFT = sr // 100, 2048
x = v.mean(1)
win = np.hanning(NFFT).astype(np.float32)
nf2 = 1 + (len(x) - NFFT) // HOP
lo, hi = int(100 * NFFT / sr), int(6000 * NFFT / sr)
Mg = np.empty((nf2, hi - lo), np.float32)
for s in range(0, nf2, 2000):
    e = min(nf2, s + 2000)
    idx = (np.arange(s, e) * HOP)[:, None] + np.arange(NFFT)[None, :]
    Mg[s:e] = np.abs(np.fft.rfft(x[idx] * win, axis=1)[:, lo:hi])
logM = np.log1p(Mg * 50)
FLUX = np.maximum(np.diff(logM, axis=0, prepend=logM[:1]), 0).sum(1)
RMS = np.sqrt((Mg ** 2).mean(1))
k = np.ones(201) / 201
FLUX = FLUX / (np.sqrt(np.convolve(FLUX ** 2, k, "same")) + 1e-9)
RMSN = RMS / (np.convolve(RMS, np.ones(401) / 401, "same").max() + 1e-9)
tf = lambda t: (t * sr - NFFT / 2) / HOP               # time -> flux frame
ft = lambda f: (f * HOP + NFFT / 2) / sr
PEAK = np.zeros_like(FLUX, bool)
PEAK[1:-1] = (FLUX[1:-1] >= FLUX[:-2]) & (FLUX[1:-1] > FLUX[2:]) & (FLUX[1:-1] > 0.9)


def snap(t, lo_t, hi_t):
    """move an onset onto the strongest nearby vocal flux peak."""
    a, b = int(tf(max(lo_t, t - 0.06))), int(tf(min(hi_t, t + 0.04))) + 1
    if b <= a:
        return t
    cand = [f for f in range(a, b) if 0 <= f < len(PEAK) and PEAK[f]]
    if not cand:
        return t
    best = max(cand, key=lambda f: FLUX[f] * np.exp(-((ft(f) - t) / 0.05) ** 2))
    return float(ft(best))


# silence gate on the emission grid: stem level 30 dB under its loud passages
_lv = 20 * np.log10(RMS + 1e-9)
_ref = np.percentile(_lv, 95)
GATE = np.zeros(nfr, bool)
for f in range(nfr):
    a, b = int(tf(f * FR)), int(tf((f + 1) * FR)) + 1
    seg = _lv[max(0, a):max(a + 1, b)]
    GATE[f] = seg.size > 0 and seg.max() < _ref - 30
GATE = torch.from_numpy(GATE)

# ---------------------------------------------------------------- forced alignment, one sung passage at a time
# lines whose LRC stamps are under GAP seconds apart are aligned as one passage
# (stars sit between lines); the long instrumental gaps split the song.
GAP = 8.0
prior = [L["lrc"] for L in lines]
groups, cur = [], [0]
for i in range(1, len(lines)):
    if prior[i] - prior[i - 1] > GAP:
        groups.append(cur); cur = []
    cur.append(i)
groups.append(cur)

ROM = [unit_romaji(L) for L in lines]
onset, tokscore, lastend = {}, {}, {}
for gi, g in enumerate(groups):
    t0 = max(0.0, prior[g[0]] - 2.5)
    t1 = min(nfr * FR, prior[g[-1]] + GAP)
    f0, f1 = int(t0 / FR), int(t1 / FR)
    toks, owner = [STAR], [None]
    for i in g:
        for k, r in enumerate(ROM[i]):
            for ch in r:
                toks.append(DICT[ch]); owner.append((i, k))
        toks.append(STAR); owner.append(None)
    em = EM[f0:f1].clone()
    em[GATE[f0:f1], :] -= 8.0                          # silent stem: letters are improbable
    em[GATE[f0:f1], BLANK] += 8.0; em[GATE[f0:f1], STAR] += 8.0
    em = em[None]
    ali, sc = AF.forced_align(em, torch.tensor([toks], dtype=torch.int32), blank=BLANK)
    spans = AF.merge_tokens(ali[0], sc[0].exp())
    assert len(spans) == len(toks), (gi, len(spans), len(toks))
    for sp, ow in zip(spans, owner):
        if ow is None:
            continue
        i, k = ow
        st, en = t0 + sp.start * FR, t0 + sp.end * FR
        if (i, k) not in onset:
            onset[(i, k)] = st
        tokscore.setdefault(i, []).append(sp.score)
        lastend[i] = en
    print(f"passage {gi}: lines {g[0]}-{g[-1]}  {t0:6.1f}-{t1:6.1f}s  {len(toks)} tokens", file=sys.stderr)

# ---------------------------------------------------------------- write lyrics.json
# The bridge's processed spoken lines can defeat the acoustic model; below
# FALLBACK mean token score a Japanese line keeps the beat-grid timings of
# lyrics_dp.json (align.py), shifted to the CTC line start.
FALLBACK = 0.02
DP = {L["i"]: L for L in json.loads((SRC / "lyrics_dp.json").read_text(encoding="utf-8"))["lines"]}
out, report = [], []
for i, L in enumerate(lines):
    us = L["units"]
    if not L["latin"] and float(np.mean(tokscore[i])) < FALLBACK:
        d = DP[i]; sh = min(onset[(i, k)] for k in range(len(us)) if (i, k) in onset) - d["t"]
        sh = sh if abs(sh) < 0.25 else 0.0
        res = [{**u, "t": round(u["t"] + sh, 4)} for u in d["units"]]
        out.append({"i": i, "t": round(d["t"] + sh, 4), "jp": L["jp"], "zh": "", "units": res,
                    "end": round(d["end"] + sh, 4), "lrc": L["lrc"], "conf": round(float(np.mean(tokscore[i])), 3)})
        report.append(f"{i:2d} lrc {L['lrc']:6.1f} -> {d['t'] + sh:7.3f}  end {d['end'] + sh:7.3f}  "
                      f"conf {np.mean(tokscore[i]):4.2f}  {L['jp']}  (beat-grid fallback)")
        continue
    sung = [k for k in range(len(us)) if (i, k) in onset]
    ts = {}
    prev = -1.0
    for k in sung:                                     # snap, keep order, >= 40 ms apart
        nxt_raw = next((onset[(i, q)] for q in sung if q > k), onset[(i, k)] + 0.5)
        t = snap(onset[(i, k)], prev + 0.04, nxt_raw - 0.04)
        t = max(t, prev + 0.04)
        ts[k] = t; prev = t
    nfirst = None
    if i + 1 < len(lines):
        nfirst = min(onset[(i + 1, q)] for q in range(len(lines[i + 1]["units"])) if (i + 1, q) in onset)
    # voice of the last mora: until the stem's level drops, capped by the next line
    a = int(tf(ts[sung[0]])); b = int(tf(lastend[i]))
    ref = np.median(RMS[a:max(b, a + 1)])
    j, cap = b, int(tf(nfirst)) if nfirst else b + 300
    while j < min(cap, len(RMS) - 1) and RMS[j] > 0.35 * ref and j - b < 250:
        j += 1
    end = max(lastend[i], ft(j))
    res = []
    for k, u in enumerate(us):
        if k in ts:
            t = ts[k]
            nk = next((q for q in sung if q > k), None)
            d = (ts[nk] if nk is not None else end) - t
        else:
            pk = max((q for q in sung if q < k), default=None)
            nk = next((q for q in sung if q > k), None)
            if u["text"] in "」?" and pk is not None:
                t = ts[pk] + 0.08
            else:                                      # 「 and spaces ride the next sung unit
                t = ts[nk if nk is not None else pk]
            d = 0.0
        res.append({"text": u["text"], "t": round(t, 4), "d": round(d, 4),
                    "read": u["read"], "mora": u["mora"], "sung": k in ts})
    conf = float(np.mean(tokscore[i]))
    t0 = ts[sung[0]]
    out.append({"i": i, "t": round(t0, 4), "jp": L["jp"], "zh": "", "units": res,
                "end": round(end, 4), "lrc": L["lrc"], "conf": round(conf, 3)})
    report.append(f"{i:2d} lrc {L['lrc']:6.1f} -> {t0:7.3f}  end {end:7.3f}  conf {conf:4.2f}  {L['jp']}  "
                  + " ".join(ROM[i][k] for k in sung))

for k, L in enumerate(out):
    L["dur"] = round(min(8.0, (out[k + 1]["t"] if k + 1 < len(out) else L["end"] + 2.0) - L["t"]), 4)

grid = json.loads((SRC / "grid.json").read_text())
doc = {"title": "スカイクラッドの観測者", "artist": "いとうかなこ", "audio": "source/music.flac",
       "audio_duration": len(v) / sr, "bpm": grid["bpm"], "aligned": "ctc", "lines": out}
(SRC / "lyrics.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
(SRC / "align_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print("\n".join(report))
