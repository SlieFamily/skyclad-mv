# -*- coding: utf-8 -*-
"""Inline lyrics.json + beats.json into src/data.js so the pages work from file://
(no fetch, no CORS, same bytes every render).

Run:  python -I src/make_data.py
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
lyr = json.loads((ROOT / "source" / "lyrics.json").read_text(encoding="utf-8"))
try:
    beats = json.loads((ROOT / "source" / "beats.json").read_text(encoding="utf-8"))
except FileNotFoundError:
    beats = {"bpm": 165.44, "beats": [], "downbeats": [], "hits": []}

grid = json.loads((ROOT / "source" / "grid.json").read_text(encoding="utf-8"))

doc = {
    "grid": grid,
    "title": lyr["title"], "artist": lyr["artist"],
    "bpm": lyr["bpm"], "duration": lyr["audio_duration"],
    "lines": lyr["lines"],
    # thin the beat grid: two decimals is plenty and keeps the file small
    "beats": [round(b, 2) for b in beats.get("beats", [])],
    "hits": [round(b, 2) for b in beats.get("hits", [])],
}
out = ROOT / "src" / "data.js"
out.write_text("window.LYRIC = " + json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + ";\n",
               encoding="utf-8")
print(f"{out}  {out.stat().st_size/1024:.0f} KB  lines={len(doc['lines'])} beats={len(doc['beats'])}")
