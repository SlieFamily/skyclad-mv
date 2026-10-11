# -*- coding: utf-8 -*-
"""Compile every formula in formulas.py with real LaTeX -> DVI -> SVG (dvisvgm),
then flatten each SVG into glyph outlines the canvas can draw with Path2D.

Output: src/tex.js   window.TEX = { name: {w, h, glyphs:[{d,x,y,tag}], rules:[{x,y,w,h,tag}]} }
Units: TeX points, origin at the formula's top-left, y down. Glyphs are sorted
left-to-right so a shot can reveal a formula in writing order.

\\tg{n}{...} in a formula becomes \\textcolor[RGB]{n,1,1}, which dvisvgm writes as
a fill colour on an enclosing <g>; that colour is decoded back into tag n.

Run:  python src/texbuild.py
"""
import json, pathlib, re, shutil, subprocess, sys, tempfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
from formulas import FORMULAS  # noqa: E402

PREAMBLE = r"""\documentclass[12pt]{article}
\usepackage{amsmath,amssymb}
\usepackage{xcolor}
\newcommand{\tg}[2]{\textcolor[RGB]{#1,1,1}{#2}}
\pagestyle{empty}
\begin{document}
"""
SVG = "{http://www.w3.org/2000/svg}"
XLINK = "{http://www.w3.org/1999/xlink}href"


def compile_one(name, src, work):
    tex = work / f"{name}.tex"
    tex.write_text(PREAMBLE + "$\\displaystyle " + src + "$\n\\end{document}\n", encoding="utf-8")
    r = subprocess.run(["latex", "-interaction=nonstopmode", "-halt-on-error", tex.name],
                       cwd=work, capture_output=True, text=True, timeout=180)
    dvi = work / f"{name}.dvi"
    if r.returncode != 0 or not dvi.exists():
        log = (work / f"{name}.log").read_text(encoding="utf-8", errors="replace")
        err = [l for l in log.splitlines() if l.startswith("!")]
        raise RuntimeError(f"{name}: latex failed: {err[:3]}")
    svg = work / f"{name}.svg"
    subprocess.run(["dvisvgm", "--no-fonts", "--exact-bbox", "-o", svg.name, dvi.name],
                   cwd=work, capture_output=True, text=True, timeout=120, check=True)
    return svg.read_text(encoding="utf-8")


def tag_of(fill):
    m = re.match(r"#([0-9a-fA-F]{2})0101$", fill or "")
    return int(m.group(1), 16) if m else 0


def flatten(svg_text):
    root = ET.fromstring(svg_text)
    vb = [float(v) for v in root.get("viewBox").split()]
    ox, oy, w, h = vb
    defs = {p.get("id"): p.get("d") for p in root.iter(SVG + "path") if p.get("id")}
    glyphs, rules = [], []

    def walk(node, tag):
        tag = tag_of(node.get("fill")) or tag
        for ch in node:
            if ch.tag == SVG + "g":
                walk(ch, tag)
            elif ch.tag == SVG + "use":
                ref = ch.get(XLINK, "").lstrip("#")
                if ref in defs:
                    glyphs.append({"d": defs[ref], "x": round(float(ch.get("x", 0)) - ox, 4),
                                   "y": round(float(ch.get("y", 0)) - oy, 4),
                                   "tag": tag_of(ch.get("fill")) or tag})
            elif ch.tag == SVG + "rect":
                rules.append({"x": round(float(ch.get("x", 0)) - ox, 4),
                              "y": round(float(ch.get("y", 0)) - oy, 4),
                              "w": round(float(ch.get("width", 0)), 4),
                              "h": round(float(ch.get("height", 0)), 4),
                              "tag": tag_of(ch.get("fill")) or tag})
            elif ch.tag == SVG + "path" and not ch.get("id"):
                # stroked/filled paths drawn in place (big delimiters, radicals)
                glyphs.append({"d": ch.get("d"), "x": -ox, "y": -oy,
                               "tag": tag_of(ch.get("fill")) or tag, "abs": 1})

    for g in root.findall(SVG + "g"):
        walk(g, 0)
    glyphs.sort(key=lambda q: (q["x"], q["y"]))
    return {"w": round(w, 4), "h": round(h, 4), "glyphs": glyphs, "rules": rules}


def main():
    if not shutil.which("latex") or not shutil.which("dvisvgm"):
        sys.exit("latex / dvisvgm not on PATH")
    out, fails = {}, []
    with tempfile.TemporaryDirectory() as td:
        work = pathlib.Path(td)
        for name, src in FORMULAS.items():
            try:
                out[name] = flatten(compile_one(name, src, work))
            except Exception as e:  # keep going; report all failures at once
                fails.append(f"{name}: {e}")
    js = ROOT / "tex.js"
    js.write_text("window.TEX = " + json.dumps(out, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{js}  {js.stat().st_size/1024:.0f} KB  ok={len(out)}/{len(FORMULAS)}")
    for n, f in out.items():
        print(f"  {n:<10} {f['w']:7.2f} x {f['h']:6.2f}pt  glyphs={len(f['glyphs']):3d} rules={len(f['rules'])}"
              f"  tags={sorted({g['tag'] for g in f['glyphs'] if g['tag']})}")
    for f in fails:
        print("FAIL", f)
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
