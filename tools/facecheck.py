# -*- coding: utf-8 -*-
"""Are two font stacks actually different SHAPES, or just different metrics?

Advance width can differ while the glyphs are the same fallback. So rasterise the
same character through each stack and hash the pixels. Same hash = same shape.

Run:  python tools/facecheck.py
"""
import hashlib, json
from playwright.sync_api import sync_playwright

STACKS = {
    "Yu Mincho":  '"Yu Mincho","YuMincho","MS PMincho",serif',
    "Yu Gothic":  '"Yu Gothic UI","Yu Gothic","Meiryo",sans-serif',
    "Meiryo":     '"Meiryo","Yu Gothic",sans-serif',
    "BIZ UDMincho": '"BIZ UDPMincho","BIZ UDMincho",serif',
    "Times":      '"Times New Roman",serif',
    "Arial Black": '"Arial Black","Impact",sans-serif',
    "Consolas":   '"Consolas","Courier New",monospace',
    "serif":      "serif",
    "sans-serif": "sans-serif",
    "monospace":  "monospace",
    "MS Gothic":  '"MS Gothic","MS PGothic",monospace',
    "UD DigiKyokasho": '"UD Digi Kyokasho N-R","UD Digi Kyokasho NK-R",sans-serif',
    "HGP":        '"HGPGothicM","HGPMinchoB",sans-serif',
}

JS = r"""
(stacks) => {
  const out = {};
  for (const [name, fam] of Object.entries(stacks)) {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 200;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0,0,200,200);
    g.fillStyle = '#fff';
    g.font = '700 120px ' + fam;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('観', 100, 105);           // 観
    const d = g.getImageData(0,0,200,200).data;
    // crude signature: ink coverage in a 16x16 grid
    const cells = [];
    for (let cy=0; cy<16; cy++) for (let cx=0; cx<16; cx++) {
      let s=0;
      for (let y=cy*12; y<cy*12+12; y+=2) for (let x=cx*12; x<cx*12+12; x+=2)
        s += d[(y*200+x)*4] > 110 ? 1 : 0;
      cells.push(s);
    }
    out[name] = cells.join(',');
  }
  return out;
}
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page()
    sig = pg.evaluate(JS, STACKS)
    b.close()

groups = {}
for name, s in sig.items():
    groups.setdefault(hashlib.md5(s.encode()).hexdigest()[:8], []).append(name)

print(f"{len(STACKS)} stacks -> {len(groups)} distinct shapes\n")
for h, names in sorted(groups.items(), key=lambda kv: -len(kv[1])):
    print(f"  {h}  {' == '.join(names)}")
