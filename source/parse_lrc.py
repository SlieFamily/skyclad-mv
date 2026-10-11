# -*- coding: utf-8 -*-
"""LRC -> source/lines.json : every SUNG line (Japanese and the latin
"Open the eyes"), tokenised into display units, each with its kana reading and
mora count. The LRC time is only a prior (whole seconds, sometimes shared by
two lines); source/align.py finds the real per-unit onsets.

Run:  python source/parse_lrc.py
"""
import json, pathlib, re, sys

SRC = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))
from readings import READINGS, mora_of  # noqa: E402

KANA = re.compile(r"[ぁ-ゖァ-ヺー]")
LATIN_LINE = re.compile(r"^[A-Za-z][A-Za-z ,.'!?]*$")


def tokenize(line):
    """Display units: one per character, latin words kept whole, spaces kept."""
    units, i = [], 0
    while i < len(line):
        ch = line[i]
        if ch.isascii() and ch.isalpha():
            j = i
            while j < len(line) and line[j].isascii() and line[j].isalpha():
                j += 1
            units.append(line[i:j]); i = j
        else:
            units.append(ch); i += 1
    return units


def main():
    rows = []
    for raw in (SRC / "lyrics.lrc").read_text(encoding="utf-8").splitlines():
        m = re.match(r"\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$", raw.strip())
        if m and m.group(3).strip():
            rows.append((int(m.group(1)) * 60 + float(m.group(2)), m.group(3).strip()))
    rows = rows[1:]                                   # row 0 is the title
    lines = []
    for t, txt in rows:
        sung = bool(KANA.search(txt)) or bool(LATIN_LINE.match(txt))
        if not sung or txt.startswith(("词", "曲")):
            continue                                  # Chinese gloss / credits
        if txt not in READINGS:
            sys.exit(f"no reading for line: {txt}")
        units = tokenize(txt)
        reads = READINGS[txt].split()
        visible = [u for u in units if u != " "]
        if len(visible) != len(reads):
            sys.exit(f"reading/unit count mismatch in {txt}: {visible} vs {reads}")
        it = iter(reads)
        out = []
        for u in units:
            if u == " ":
                out.append({"text": " ", "read": "", "mora": 0.0})
            else:
                r = next(it)
                out.append({"text": u, "read": r, "mora": mora_of(r)})
        lines.append({"i": len(lines), "lrc": t, "jp": txt, "latin": bool(LATIN_LINE.match(txt)),
                      "units": out, "mora": sum(u["mora"] for u in out)})
    (SRC / "lines.json").write_text(json.dumps(lines, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(lines)} sung lines, {sum(len(l['units']) for l in lines)} units, "
          f"{sum(l['mora'] for l in lines):.0f} morae")


if __name__ == "__main__":
    main()
