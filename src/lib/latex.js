/* ===================================================================
   Real LaTeX on canvas.

   src/texbuild.py compiles every formula with latex + dvisvgm; src/tex.js holds
   the glyph outlines (TeX points, y down, top-left origin). This file only
   draws them: Path2D per glyph, cached, so a formula is genuine Computer
   Modern typesetting that can still be revealed glyph by glyph.

   drawTex(g, name, cx, cy, height, opts)
     opts.color      base colour
     opts.tags       {1:'#ffb347', 2:'#7fd8ff'} colour per \tg{n}{} group
     opts.reveal     0..1, fraction of glyphs drawn (writing order, left→right)
     opts.alpha      overall alpha
     opts.glow       shadow blur in px (0 = none)
     opts.anchor     'center' | 'left'
   returns {x, y, w, h, scale} of the drawn box in canvas pixels
   =================================================================== */

const _texPaths = new Map();
function texPath(d) {
  let p = _texPaths.get(d);
  if (!p) { p = new Path2D(d); _texPaths.set(d, p); }
  return p;
}

function texBox(name, height) {
  const f = window.TEX && window.TEX[name];
  if (!f) throw new Error('unknown formula ' + name);
  const s = height / f.h;
  return { f, s, w: f.w * s, h: height };
}

/* the height that makes a formula exactly `width` px wide, capped */
function texFitHeight(name, width, maxH) {
  const f = window.TEX[name];
  return Math.min(maxH, width * f.h / f.w);
}

function drawTex(g, name, cx, cy, height, opts = {}) {
  const { f, s, w, h } = texBox(name, height);
  const x0 = opts.anchor === 'left' ? cx : cx - w / 2;
  const y0 = cy - h / 2;
  const n = f.glyphs.length + f.rules.length;
  const reveal = opts.reveal ?? 1;
  const shown = reveal * n;
  const base = opts.color || '#e8f6ff';
  const tags = opts.tags || {};

  /* glyphs and rules interleave by x so a fraction bar appears with its numerator */
  const items = [];
  for (const q of f.glyphs) items.push({ k: 'g', x: q.abs ? 0 : q.x, q });
  for (const r of f.rules) items.push({ k: 'r', x: r.x, q: r });
  items.sort((a, b) => a.x - b.x);

  const passes = (opts.glow ?? 0) > 0
    ? [[opts.glow, 0.6], [opts.glow * 0.3, 0.9], [0, 1]]
    : [[0, 1]];

  for (const [blur, pa] of passes) {
    g.save();
    g.translate(x0, y0);
    g.scale(s, s);
    for (let i = 0; i < items.length; i++) {
      /* the glyph being written right now fades in over one glyph's worth */
      const a = clamp(shown - i, 0, 1);
      if (a <= 0) break;
      const it = items[i], q = it.q;
      const col = tags[q.tag] || base;
      g.globalAlpha = (opts.alpha ?? 1) * pa * a;
      g.fillStyle = col;
      g.shadowColor = col;
      g.shadowBlur = blur;          // shadowBlur is in device px, unaffected by scale
      if (it.k === 'r') {
        g.fillRect(q.x, q.y, q.w, q.h);
      } else if (q.abs) {
        g.save(); g.translate(q.x, q.y); g.fill(texPath(q.d)); g.restore();
      } else {
        g.save(); g.translate(q.x, q.y); g.fill(texPath(q.d)); g.restore();
      }
    }
    g.restore();
  }
  return { x: x0, y: y0, w, h, scale: s };
}

/* centre (in canvas px) of every glyph carrying a given tag — lets a shot
   point at the |0> ket, or fly the φ out of the formula */
function texTagBox(name, tag, cx, cy, height, anchor = 'center') {
  const { f, s, w, h } = texBox(name, height);
  const x0 = anchor === 'left' ? cx : cx - w / 2, y0 = cy - h / 2;
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
  for (const q of f.glyphs) if (q.tag === tag && !q.abs) {
    minx = Math.min(minx, q.x); maxx = Math.max(maxx, q.x + 6);
    miny = Math.min(miny, q.y - 7); maxy = Math.max(maxy, q.y + 2);
  }
  if (minx > maxx) return null;
  return { x: x0 + minx * s, y: y0 + miny * s, w: (maxx - minx) * s, h: (maxy - miny) * s };
}
