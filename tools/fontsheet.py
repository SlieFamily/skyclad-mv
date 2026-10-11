# -*- coding: utf-8 -*-
"""Render a contact sheet of the typefaces this machine actually has, using the
@font-face-free stacks the film will use, so we pick shapes we can reproduce
byte-identically on a re-render.

Run:  python tools/fontsheet.py  ->  out/qa/fontsheet.png
"""
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "qa" / "fontsheet.png"; OUT.parent.mkdir(parents=True, exist_ok=True)

SPECS = [
    ("mincho 700",   '"Yu Mincho","YuMincho","MS PMincho",serif', 700),
    ("mincho 900",   '"Yu Mincho","YuMincho","MS PMincho",serif', 900),
    ("msmincho 700", '"MS Mincho","MS PMincho",serif', 700),
    ("msmincho 900", '"MS Mincho","MS PMincho",serif', 900),
    ("yugothic 700", '"Yu Gothic UI","Yu Gothic","Meiryo",sans-serif', 700),
    ("yugothic 900", '"Yu Gothic UI","Yu Gothic","Meiryo",sans-serif', 900),
    ("meiryo 700",   '"Meiryo","Yu Gothic",sans-serif', 700),
    ("meiryo 900",   '"Meiryo","Yu Gothic",sans-serif', 900),
    ("bizudmincho",  '"BIZ UDPMincho","BIZ UDMincho",serif', 700),
    ("bizudgothic",  '"BIZ UDGothic","BIZ UDPGothic",sans-serif', 700),
    ("times",        '"Times New Roman",serif', 700),
    ("georgia",      '"Georgia",serif', 700),
    ("rockwell",     '"Rockwell","Bookman Old Style",Georgia,serif', 700),
    ("consolas",     '"Consolas","Courier New",monospace', 700),
    ("arialblack",   '"Arial Black","Impact",sans-serif', 400),
    ("segoe",        '"Segoe UI","Microsoft YaHei",sans-serif', 700),
]

S1 = "観測者「０」過去"
S2 = "並行する無数の線 Ψ 収束"

rows = "\n".join(
    f'<div class="row"><div class="lab">{n}</div>'
    f'<div class="g1" style="font-family:{f};font-weight:{w}">{S1}</div>'
    f'<div class="g2" style="font-family:{f};font-weight:{w}">{S2}</div></div>'
    for n, f, w in SPECS
)

HTML = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;background:#0b0f10;color:#dff5ea}}
.row{{display:flex;align-items:baseline;gap:26px;padding:8px 26px;border-bottom:1px solid #1d2b28}}
.lab{{width:190px;font:500 19px Consolas,monospace;color:#ffb347;flex:none}}
.g1{{font-size:58px;white-space:nowrap}}
.g2{{font-size:30px;white-space:nowrap;color:#7fd8ff}}
</style></head><body>{rows}</body></html>"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1700, "height": 40 + len(SPECS) * 82})
    pg.set_content(HTML)
    pg.wait_for_timeout(500)
    pg.screenshot(path=str(OUT), full_page=True)
    # Which families does this engine really resolve? Measure each one alone and
    # compare against the guaranteed fallback: if a face is missing the numbers
    # collapse onto the fallback's, which is how we catch a silent substitution.
    info = pg.evaluate("""(specs) => {
      const cv = document.createElement('canvas').getContext('2d');
      const meas = (fam, wt) => {
        cv.font = wt + ' 58px ' + fam + ', monospace';
        const cjk = cv.measureText('観').width, jp = cv.measureText('の').width,
              lat = cv.measureText('W').width, it = cv.measureText('Won').width;
        return {cjk, jp, lat, it};
      };
      const base = meas('__nonexistent_face__', 400);
      const out = [];
      for (const [name, fam, wt] of specs) {
        // strip to the first concrete family in the stack
        const first = fam.split(',')[0].replace(/"/g, '');
        const m = meas(first, wt);
        const same = Math.abs(m.cjk - base.cjk) < 0.01 && Math.abs(m.it - base.it) < 0.01;
        out.push(name.padEnd(14) + ' cjk=' + m.cjk.toFixed(1) + ' W=' + m.lat.toFixed(1) +
                 ' Won=' + m.it.toFixed(1) + (same ? '   <-- MISSING (falls back)' : ''));
      }
      return out;
    }""", [[n, f, w] for n, f, w in SPECS])
    b.close()

print(str(OUT))
print("\n".join(info))
print("\n(fontsize 58px: CJK advance should be ~58 for any working Japanese face;")
print(" a fallback shows up as a wildly different latinW vs CJK ratio.)")
