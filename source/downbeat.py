# -*- coding: utf-8 -*-
"""Pick the downbeat phase from section changes, then write it into grid.json.

Sections in this song start on a bar line, and a section start is where the
per-beat loudness jumps. So for each of the 4 possible phases, average the
loudness jump at the beats that phase calls "bar starts"; the true phase has
by far the biggest jumps. (The comb-strength guess in tempo.py picked a phase
one beat early: every section change landed one beat after its bar line.)

Run:  python source/downbeat.py
"""
import json, pathlib, subprocess
import numpy as np

SRC = pathlib.Path(__file__).resolve().parent
gp = SRC / "grid.json"
g = json.loads(gp.read_text())
SR, per, f0 = g["sr"], g["beat_period_samples"], g["first_beat_sample"]

raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(SRC / "music.flac"), "-ac", "1", "-ar", str(SR),
                      "-f", "f32le", "-"], capture_output=True, check=True).stdout
x = np.frombuffer(raw, "<f4").astype(np.float64)
nb = int((len(x) - f0) / per)
db = np.array([20 * np.log10(np.sqrt((x[int(f0 + k * per):int(f0 + (k + 1) * per)] ** 2).mean()) + 1e-9)
               for k in range(nb)])
jump = np.abs(np.diff(db, prepend=db[0]))
# only the big jumps say anything about form; ordinary beat-to-beat wobble is noise
big = jump * (jump > np.percentile(jump, 90))
score = [big[p::4].mean() for p in range(4)]
best = int(np.argmax(score))
print("jump score by phase:", [round(s, 3) for s in score], "-> downbeat phase", best)
g["downbeat_index_offset"] = best
g["downbeat_method"] = "section-change loudness jumps (source/downbeat.py)"
gp.write_text(json.dumps(g, indent=1), encoding="utf-8")
bar = lambda n: (f0 + (best + 4 * n) * per) / SR
print("bar 0 at %.3fs, bar length %.4fs" % (bar(0), 4 * per / SR))
