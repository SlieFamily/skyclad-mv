# -*- coding: utf-8 -*-
"""Per-unit vocal onsets for every sung line  ->  source/lyrics.json

No ML: a centre-channel, harmonic-only spectrogram stands in for the vocal
stem (side subtraction removes the wide guitars, median-filter HPSS removes
drums), its spectral flux is the onset evidence, and a dynamic program puts
each line's units on the 16th-note grid of grid.json so they land on strong
vocal onsets while keeping a singable rhythm. The LRC time is a soft prior.

Run:  python source/align.py      (needs lines.json from parse_lrc.py)
"""
import json, pathlib, subprocess
import numpy as np
from scipy.ndimage import median_filter, uniform_filter1d

SRC = pathlib.Path(__file__).resolve().parent
grid = json.loads((SRC / "grid.json").read_text())
SR, PER, F0 = grid["sr"], grid["beat_period_samples"], grid["first_beat_sample"]
SLOT = PER / 4 / SR                                   # one 16th note, seconds
lines = json.loads((SRC / "lines.json").read_text(encoding="utf-8"))
slot_of = lambda t: (t * SR - F0) / (PER / 4)
time_of = lambda j: (F0 + np.asarray(j) * PER / 4) / SR

# ---------------------------------------------------------------- evidence
raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(SRC / "music.flac"), "-ac", "2", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
st = np.frombuffer(raw, "<f4").reshape(-1, 2)
mid, side = (st[:, 0] + st[:, 1]) * 0.5, (st[:, 0] - st[:, 1]) * 0.5
NFFT, HOP = 2048, 480                                  # 10 ms hop
lo, hi = int(150 * NFFT / SR), int(4000 * NFFT / SR)
win = np.hanning(NFFT).astype(np.float32)
nfr = 1 + (len(mid) - NFFT) // HOP


def mag(sig):
    out = np.empty((nfr, hi - lo), np.float32)
    for s in range(0, nfr, 2000):
        e = min(nfr, s + 2000)
        idx = (np.arange(s, e) * HOP)[:, None] + np.arange(NFFT)[None, :]
        out[s:e] = np.abs(np.fft.rfft(sig[idx] * win, axis=1)[:, lo:hi])
    return out


C = np.maximum(mag(mid) - 1.2 * mag(side), 0)          # centre-panned content
H = median_filter(C, size=(17, 1))                      # steady along time = harmonic
P = median_filter(C, size=(1, 17))                      # steady along freq = percussive
V = C * (H ** 2 / (H ** 2 + P ** 2 + 1e-12))
logV = np.log1p(V * 30)
flux = np.maximum(np.diff(logV, axis=0, prepend=logV[:1]), 0).sum(1)
voic = logV.sum(1)
lnorm = lambda e, w: e / (np.sqrt(uniform_filter1d(e ** 2, int(w * SR / HOP))) + 1e-9)
flux, voic = lnorm(flux, 2.0), lnorm(voic, 4.0)
frame_of = lambda t: (t * SR - NFFT / 2) / HOP

nslots = int(slot_of(len(mid) / SR)) + 1
EV = np.zeros(nslots); VO = np.zeros(nslots)
for j in range(nslots):
    t = float(time_of(j))
    a, b = int(frame_of(t - 0.03)), int(frame_of(t + 0.045)) + 1
    c, d = int(frame_of(t)), int(frame_of(t + SLOT)) + 1
    if a >= 0 and b < nfr:
        EV[j] = min(3.0, flux[a:b].max())
        VO[j] = voic[c:d].mean()

# ---------------------------------------------------------------- DP (one note per mora)
NEG = -1e9
RATES = {1: 0.8, 1.5: 0.6, 2: 0.0, 3: 0.3, 4: 0.5, 6: 0.9, 8: 1.2, 10: 1.5}   # slots/mora : prior cost
VOWEL = set("あいうえおアイウエオ")
SMALL = set("ゃゅょぁぃぅぇぉャュョァィゥェォ")


def morae(u):
    """Onset weight of each sung mora of a unit. Japanese lyrics are set one
    note per mora, so every mora gets a slot; morae that continue a vowel or
    are ん / っ / ー have weak onsets and weigh less."""
    r = u["read"]
    if r in ("_", ""):
        return []
    if r.isdigit():                                    # latin word: one note per syllable
        return [0.6 if (k == 0 and u["text"][0].lower() in "aeiou") else 1.0 for k in range(int(r))]
    ms = []
    for c in r:
        if c in SMALL and ms:
            ms[-1] += c
        else:
            ms.append(c)
    return [0.15 if m[0] in "っッ" else 0.25 if m[0] == "ー" else 0.45 if m[0] in "んン"
            else (0.6 if k == 0 else 0.35) if m[0] in VOWEL else 1.0 for k, m in enumerate(ms)]


def dp(seq, ev, lo_t, hi_start_t, end_t, rate, centre):
    """seq: one (weight, rest_allowed_before) per mora -> (score, slot per mora)"""
    J = np.arange(int(np.ceil(slot_of(lo_t))), int(np.floor(slot_of(end_t))) + 1)
    n = len(seq)
    if len(J) < n + 1:
        return NEG, None
    E, Vv = ev[J], VO[J]
    sc = np.full((n, len(J)), NEG); back = np.zeros((n, len(J)), int)
    s0 = seq[0][0] * E + 0.25 * Vv - 0.5 * ((time_of(J) - centre) / 0.7) ** 2
    s0[J > slot_of(hi_start_t)] = NEG
    sc[0] = s0
    gmin, gmax = max(1, int(round(0.5 * rate))), int(round(2.2 * rate)) + 1
    for k in range(1, n):
        w, rest = seq[k]
        top = min(gmax + (12 if rest else 0), len(J) - 1)
        best = np.full(len(J), NEG); arg = np.zeros(len(J), int)
        for gp in range(gmin, top + 1):
            c = 1.2 * np.log2(gp / rate) ** 2
            if rest and gp > rate:
                c = min(c, 0.4 + 0.06 * (gp - rate))   # a rest at a word gap is cheap
            cand = np.full(len(J), NEG); cand[gp:] = sc[k - 1][:-gp] - c
            upd = cand > best; best[upd] = cand[upd]; arg[upd] = gp
        sc[k] = best + w * E + 0.25 * Vv
        back[k] = arg
    fin = sc[-1]
    i = int(np.argmax(fin))
    if fin[i] <= NEG / 2:
        return NEG, None
    path = [i]
    for k in range(n - 1, 0, -1):
        path.append(path[-1] - back[k][path[-1]])
    return fin[i] - RATES[rate], [int(J[p]) for p in reversed(path)]


# ---------------------------------------------------------------- pooling across repeats
form = json.loads((SRC / "form.json").read_text())
SECTS = [  # (start beat, end beat, [beat offsets of the other occurrences])
    (68, 168, [form["repeats"]["V2"]["offset_beats"]]),
    (164, 252, [form["repeats"]["C2"]["offset_beats"], form["repeats"]["CF"]["offset_beats"]]),
]


def pooled(t):
    """EV with the same melody's evidence from its other occurrences added in."""
    b = (t * SR - F0) / PER
    for a, e, offs in SECTS:
        for base in [0] + offs:
            if a + base <= b < e + base:
                others = [o - base for o in [0] + offs if o != base]
                ev = EV.copy()
                for d in others:
                    sh = 4 * d                          # beats -> slots
                    src = np.zeros_like(EV)
                    if sh >= 0: src[:len(EV) - sh] = EV[sh:]
                    else: src[-sh:] = EV[:len(EV) + sh]
                    ev += 1.0 * src
                return ev / (1 + len(others)), True
    return EV, False


def occurrence(t):
    b = (t * SR - F0) / PER
    for a, e, offs in SECTS:
        for base in [0] + offs:
            if a + base <= b < e + base:
                return [o - base for o in [0] + offs if o != base]
    return None


def shared_lrc(L):
    """LRC stamps are whole seconds and drift; the same melodic line in every
    repeat of the section gets one prior: the mean of all their stamps."""
    others = occurrence(L["lrc"])
    if others is None:
        return L["lrc"]
    vals = [L["lrc"]]
    for d in others:
        ds = d * PER / SR
        near = [M["lrc"] - ds for M in lines if M["latin"] == L["latin"] and abs(M["lrc"] - ds - L["lrc"]) < 1.6]
        if near:
            vals.append(min(near, key=lambda v: abs(v - L["lrc"])))
    return float(np.mean(vals))


out, report, prev_last = [], [], 0.0
for li, L in enumerate(lines):
    units = L["units"]
    seq, owner = [], []                                 # one entry per sung mora
    for k, u in enumerate(units):
        for q, w in enumerate(morae(u)):
            rest = q == 0 and k > 0 and units[k - 1]["text"] == " "
            seq.append((w, rest)); owner.append(k)
    nxt = lines[li + 1]["lrc"] if li + 1 < len(lines) else L["lrc"] + 8
    lrc = shared_lrc(L)
    if L["latin"]:                                      # shouted pickup, often stamped late
        lo_t, hi_t, centre, end_t = lrc - 1.8, lrc + 0.6, lrc - 0.5, nxt + 0.6
    else:
        lo_t, hi_t, centre = lrc - 1.0, lrc + 1.6, lrc + 0.35
        end_t = nxt + (0.6 if nxt == lrc else 1.2)
    lo_t = max(lo_t, prev_last + SLOT)
    ev, pool = pooled(L["lrc"])
    best = (NEG, None, None)
    for r in RATES:
        s, path = dp(seq, ev, lo_t, hi_t, end_t, r, centre)
        if path and s - RATES[r] > best[0]:
            best = (s - RATES[r], path, r)
    score, path, rate = best
    if path is None:
        raise SystemExit(f"line {li} {L['jp']}: no feasible alignment")
    # hold of the last sung mora: until the voice drops, capped by the next line
    jl = path[-1]; ref = np.median(VO[path[0]:jl + 1])
    j, cap = jl + 1, (int(slot_of(nxt + 0.6)) if li + 1 < len(lines) else jl + 40)
    while j < min(cap, nslots - 1) and VO[j] > 0.5 * ref and j - jl < 40:
        j += 1
    last_end = max(float(time_of(jl)) + 0.25, float(time_of(j)))
    first = {}                                          # unit -> slot of its first mora
    for m, k in enumerate(owner):
        first.setdefault(k, path[m])
    sung_k = sorted(first)
    res = []
    for k, u in enumerate(units):
        if k in first:
            t = float(time_of(first[k]))
            nk = next((q for q in sung_k if q > k), None)
            d = (float(time_of(first[nk])) if nk is not None else last_end) - t
        else:
            pk = max((q for q in sung_k if q < k), default=None)
            nk = next((q for q in sung_k if q > k), None)
            if u["text"] in "」?" and pk is not None:
                t = float(time_of(first[pk])) + 0.08
            else:                                       # 「 and spaces ride the next sung unit
                t = float(time_of(first[nk if nk is not None else pk]))
            d = 0.0
        res.append({"text": u["text"], "t": round(t, 4), "d": round(d, 4),
                    "read": u["read"], "mora": u["mora"], "sung": k in first})
    t0 = float(time_of(path[0]))
    conf = float(np.mean([EV[j] for j in path]))
    pos = (path[0] - 4 * grid["downbeat_index_offset"]) % 16
    out.append({"i": li, "t": round(t0, 4), "jp": L["jp"], "zh": "", "units": res,
                "end": round(last_end, 4), "rate": rate, "lrc": L["lrc"], "prior": round(lrc, 3), "conf": round(conf, 3),
                "bar_pos16": int(pos)})
    report.append(f"{li:2d} lrc {L['lrc']:6.1f} prior {lrc:7.2f} -> {t0:7.3f} bar16 {pos:2d}  "
                  f"end {last_end:7.3f}  rate {rate:<3}{' pooled' if pool else '       '} conf {conf:4.2f}  {L['jp']}")
    prev_last = float(time_of(path[-1]))

for k, L in enumerate(out):                            # dur = time until the next line starts
    L["dur"] = round(min(8.0, (out[k + 1]["t"] if k + 1 < len(out) else L["end"] + 2.0) - L["t"]), 4)

doc = {"title": "スカイクラッドの観測者", "artist": "いとうかなこ", "audio": "source/music.flac",
       "audio_duration": len(mid) / SR, "bpm": grid["bpm"], "aligned": True, "lines": out}
(SRC / "lyrics.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
(SRC / "align_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print("\n".join(report))
print(f"mean evidence on chosen slots {np.mean([l['conf'] for l in out]):.2f}  vs all slots {EV.mean():.2f}")
