/* ===================================================================
   Kinetic type. Every sung unit appears on the frame its voice lands.
   Faces carry meaning (see brief): each character gets one by rule, with a
   per-line override table for the words that matter.
   =================================================================== */
const KANA_RE = /[ぁ-ゖ]/, KATA_RE = /[ァ-ヺー]/;
const FACE_WORD = {
  // doctrine — the slow serif of scripture
  mincho: '神創世界完全絶対均衡奇跡宇宙規模守英知与領域果招閉',
  // the observer, the self — heavy sans
  gothic: '観測者僕存在疑目映景色矛盾気付背選択冒涜収束再生',
  // time and theory — universal-design serif
  ud: '過去未来今時間針概念歪光速理論秩序無限点並行線数',
  // the machine
  msgoth: 'ゲートロジックパルス',
  // numbers
  slab: '０１',
};
const FACE_OF = {};
for (const [f, s] of Object.entries(FACE_WORD)) for (const ch of s) FACE_OF[ch] = FACE_OF[ch] || f;

function faceOf(ch) {
  if (FACE_OF[ch]) return FACE_OF[ch];
  if ('「」'.includes(ch)) return 'mincho';
  if (KATA_RE.test(ch)) return 'msgoth';
  if (KANA_RE.test(ch)) return 'meiryo';
  if (/[A-Za-z]/.test(ch)) return 'latin';
  return 'mincho';
}
const WEIGHT = { mincho: 900, gothic: 900, ud: 700, meiryo: 700, msgoth: 400, slab: 900, latin: 700, mono: 700 };
/* relative size per face: kana and particles sit smaller, so a line has rhythm */
const SCALE = { mincho: 1.0, gothic: 1.06, ud: 1.0, meiryo: 0.74, msgoth: 0.9, slab: 1.15, latin: 0.95, mono: 0.9 };
const fontOf = (f, px) => `${WEIGHT[f]} ${px}px ${FONT_STACKS[f]}`;

const _mc = document.createElement('canvas').getContext('2d');
const _adv = new Map();
function adv(text, f) {
  const k = f + '|' + text;
  let w = _adv.get(k);
  if (w === undefined) { _mc.font = fontOf(f, 100); w = _mc.measureText(text).width / 100; _adv.set(k, w); }
  return w;
}

/* Layout a line into rows (split at its own spaces) with per-unit size.
   Returns glyph records in logical px relative to the block centre. */
const _lay = new Map();
function layoutLine(L, size, opts = {}) {
  const key = L.i + '|' + size + '|' + (opts.maxW || 0) + '|' + (opts.oneRow ? 1 : 0) + '|' + (opts.align || 'c') + '|' + (opts.face || '');
  if (_lay.has(key)) return _lay.get(key);
  const rows = [[]];
  for (const u of L.units) {
    if (u.text === ' ') { if (!opts.oneRow && !L.latin) rows.push([]); else rows[rows.length - 1].push({ u, space: true }); continue; }
    rows[rows.length - 1].push({ u });
  }
  const gap = 0.04;
  const measured = rows.map(r => {
    let x = 0;
    const gl = r.map(q => {
      if (q.space) { const w = 0.45 * size; const o = { ...q, x, w, s: 0 }; x += w; return o; }
      const f = opts.face || (L.latin ? 'latin' : faceOf(q.u.text));
      const s = size * (L.latin ? 1 : SCALE[f]) * (opts.scaleOf ? opts.scaleOf(q.u) : 1);
      const w = adv(q.u.text, f) * s;
      const o = { u: q.u, f, s, x, w };
      x += w + (L.latin ? 0.28 * s : gap * s);
      return o;
    });
    return { gl, w: x };
  });
  let k = 1;
  if (opts.maxW) k = Math.min(1, opts.maxW / Math.max(...measured.map(r => r.w)));
  const rowH = size * 1.2 * k;
  const out = [];
  measured.forEach((r, ri) => {
    const y = (ri - (measured.length - 1) / 2) * rowH;
    for (const q of r.gl) {
      if (q.space) continue;
      const x0 = opts.align === 'left' ? 0 : opts.align === 'right' ? -r.w : -r.w / 2;
      out.push({ u: q.u, f: q.f, s: q.s * k, x: (q.x + x0) * k + q.w * k / 2, y, w: q.w * k, row: ri });
    }
  });
  const res = { glyphs: out, k, rows: measured.length, rowH, w: Math.max(...measured.map(r => r.w)) * k };
  _lay.set(key, res);
  return res;
}

/* the animated state of one glyph at time t: strike in, settle, exit */
function glyphState(q, L, t, o = {}) {
  const dt = t - q.u.t;
  if (dt < -0.02) return null;
  const inn = clamp((dt + 0.02) / 0.06, 0, 1);
  const pop = 1 + (o.pop ?? 0.32) * Math.exp(-Math.max(dt, 0) * 13) * Math.cos(Math.max(dt, 0) * 26);
  const exitDur = o.exitDur ?? 0.35;
  // Changed: whole line exits together at L.off, not per-glyph fade
  const ex = o.keep ? 0 : smoothstep((o.offAt ?? L.off) - exitDur, o.offAt ?? L.off, t);
  return { dt, a: inn * (1 - ex), k: pop, ex };
}

/* draw a line as kinetic type. style: {color, glow, sub, x, y, size, maxW, exit: fn} */
function drawLyric(g, L, t, st) {
  if (!st.keep && (t < L.on || t > L.off)) return null;
  if (st.keep && t < L.on) return null;
  const lay = layoutLine(L, st.size, { maxW: st.maxW ?? 1640, oneRow: st.oneRow, align: st.align, face: st.fontOverride });
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < lay.glyphs.length; i++) {
    const q = lay.glyphs[i];
    const s = glyphState(q, L, t, st);
    if (!s || s.a <= 0.002) continue;
    let x = st.x + q.x, y = st.y + q.y, rot = 0, sc = s.k, a = s.a;
    if (st.motion) ({ x, y, rot, sc, a } = st.motion(q, s, x, y, i, lay) || { x, y, rot, sc, a });
    const col = st.colorOf ? st.colorOf(q, s) : st.color;
    g.save();
    g.translate(x, y); if (rot) g.rotate(rot); g.scale(sc, sc);
    g.globalAlpha = a;
    g.font = fontOf(q.f, q.s);
    if (st.glow) {
      g.shadowColor = col; g.shadowBlur = BL(q.s * st.glow);
      g.fillStyle = col; g.fillText(q.u.text, 0, 0);
      g.shadowBlur = 0;
    }
    g.fillStyle = st.core || col;
    g.fillText(q.u.text, 0, 0);
    if (st.flash && s.dt < 0.22) {                 // the strike: a hot overprint that cools
      g.globalAlpha = a * (1 - s.dt / 0.22) * st.flash;
      g.fillStyle = '#ffffff'; g.fillText(q.u.text, 0, 0);
    }
    g.restore();
    if (st.after) st.after(q, s, x, y);
  }
  g.restore();
  return lay;
}

/* the most recent line(s) on screen at t, from a list of indices */
const linesIn = (idx, t) => idx.map(i => LINES[i]).filter(L => t >= L.on && t <= L.off);
