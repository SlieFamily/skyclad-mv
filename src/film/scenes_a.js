/* ===================================================================
   Plan A scenes: the observer's CRT.
   =================================================================== */

/* ---------- A1: power-on, title, the observer in orbit (0 – 24.61) ---------- */
const TITLE = 'スカイクラッドの観測者';
const TITLE_L = { i: 900, latin: false, jp: TITLE, units: [...TITLE].map((c, k) => ({ text: c, t: beatTime(8 + k), sung: true })) };
TITLE_L.on = TITLE_L.units[0].t - 0.05; TITLE_L.off = 1e9; TITLE_L.first = TITLE_L.units[0].t; TITLE_L.last = TITLE_L.units[10].t;
const ARTIST_L = { i: 901, latin: false, jp: 'いとうかなこ', units: [...'いとうかなこ'].map((c, k) => ({ text: c, t: beatTime(21) + k * BEAT / 2, sung: true })) };
ARTIST_L.on = ARTIST_L.units[0].t - 0.05; ARTIST_L.off = 1e9;

function globePts(t, cx, cy, R, yaw, tilt) {
  const cy_ = Math.cos(tilt), sy_ = Math.sin(tilt), cyaw = Math.cos(yaw), syaw = Math.sin(yaw);
  return (x, y, z) => {
    const x1 = x * cyaw + z * syaw, z1 = -x * syaw + z * cyaw;
    const y2 = y * cy_ - z1 * sy_, z2 = y * sy_ + z1 * cy_;
    const k = 900 / (900 + z2 * R);
    return [cx + x1 * R * k, cy - y2 * R * k, z2];
  };
}
function drawGlobe(g, t, cx, cy, R, a) {
  const P = globePts(t, cx, cy, R, t * 0.25, 0.42);
  g.save(); g.globalAlpha *= a; g.lineWidth = 1.6;
  const seg = (pts) => {                      // back-facing parts dimmer
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i][2] < 0 ? 0.85 : 0.22;
      g.strokeStyle = rgba(CC.phos, b);
      g.beginPath(); g.moveTo(pts[i - 1][0], pts[i - 1][1]); g.lineTo(pts[i][0], pts[i][1]); g.stroke();
    }
  };
  for (let la = -60; la <= 60; la += 30) {
    const r = Math.cos(la * Math.PI / 180), y = Math.sin(la * Math.PI / 180);
    seg(Array.from({ length: 49 }, (_, i) => P(r * Math.cos(i / 48 * TAU), y, r * Math.sin(i / 48 * TAU))));
  }
  for (let lo = 0; lo < 180; lo += 30) {
    const c = Math.cos(lo * Math.PI / 180), s = Math.sin(lo * Math.PI / 180);
    seg(Array.from({ length: 49 }, (_, i) => { const th = i / 48 * TAU; return P(Math.cos(th) * c, Math.sin(th), Math.cos(th) * s); }));
  }
  g.restore();
  return P;
}
/* the satellite: on an inclined orbit, period = 4 bars */
function satPos(P, t) {
  const th = (t / (4 * BAR)) * TAU + 1.2, inc = 0.9, rr = 1.55;
  const x = Math.cos(th) * rr, z0 = Math.sin(th) * rr;
  return { p: P(x, z0 * Math.sin(inc) * 0.5, z0 * Math.cos(inc)), th, rr, inc };
}

function aIntro(g, t, io) {
  let focus = [W / 2, H / 2];
  const draw = () => {
    tube(g, t, { amp: smoothstep(1.2, 4, t), traceA: 1 - smoothstep(10, 12, t) * 0.6 });
    /* spectrum along the bottom, real bands of the record */
    const sa = smoothstep(2.6, 3.4, t);
    if (sa > 0) {
      g.save(); g.globalAlpha = sa;
      for (let k = 0; k < 32; k++) {
        const v = band(t, k), x = 300 + k * 41, h = 8 + v * v * 150;
        g.fillStyle = rgba(k % 8 === 0 ? CC.amber : CC.phos, 0.55 + 0.4 * v);
        g.fillRect(x, 960 - h, 26, h);
      }
      g.restore();
    }
    /* the title: one character per beat, then it rises to the top as a running head */
    const up = easeInOut(smoothstep(beatTime(40), beatTime(46), t));
    g.save();
    g.translate(lerp(W / 2, W / 2, up), lerp(450, 70, up)); g.scale(lerp(1, 0.22, up), lerp(1, 0.22, up));
    aLyric(g, TITLE_L, t, { x: 0, y: 0, size: 168, maxW: 1700, oneRow: true, keep: true,
      colorOf: q => q.u.text === '観' || q.u.text === '測' || q.u.text === '者' ? CC.phos : q.f === 'msgoth' ? CC.amber : CC.pale });
    aLyric(g, ARTIST_L, t, { x: 0, y: 170, size: 74, maxW: 900, oneRow: true, keep: true, colorOf: () => CC.cyan, glow: 0.1 });
    g.restore();
    /* the globe and the satellite: the observer in orbit */
    const ga = smoothstep(beatTime(42), beatTime(48), t);
    let sat = null;
    if (ga > 0) {
      const R = lerp(150, 250, easeOut(smoothstep(beatTime(42), beatTime(52), t)));
      const P = drawGlobe(g, t, W / 2, 600, R, ga);
      const s = satPos(P, t);
      /* orbit path */
      g.save(); g.globalAlpha = ga * 0.7; g.strokeStyle = rgba(CC.amber, 0.6); g.setLineDash([6, 10]); g.lineWidth = 1.5;
      g.beginPath();
      for (let i = 0; i <= 96; i++) { const th = i / 96 * TAU; const q = P(Math.cos(th) * s.rr, Math.sin(th) * s.rr * Math.sin(s.inc) * 0.5, Math.sin(th) * s.rr * Math.cos(s.inc)); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.stroke(); g.restore();
      sat = s.p;
      g.save(); g.globalAlpha = ga;
      g.fillStyle = CC.amber; g.fillRect(sat[0] - 5, sat[1] - 5, 10, 10);
      g.strokeStyle = CC.amber; g.lineWidth = 2; g.beginPath(); g.moveTo(sat[0] - 22, sat[1]); g.lineTo(sat[0] + 22, sat[1]); g.stroke();
      /* lock-on: brackets close on the satellite over two bars */
      const lk = easeInOut(smoothstep(beatTime(64), beatTime(72), t));
      if (lk > 0) {
        const sz = lerp(260, 54, lk);
        brackets(g, sat[0], sat[1], sz, sz, rgba(CC.red, 0.9), lk);
        g.font = `700 22px ${FONT_STACKS.mono}`; g.fillStyle = rgba(CC.red, 0.9 * lk); g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(lk > 0.98 ? 'OBSERVER  LOCKED' : 'ACQUIRING ' + (lk * 100).toFixed(0).padStart(3, '0') + '%', sat[0] + sz / 2 + 14, sat[1] - sz / 2);
      }
      g.restore();
      drawTex(g, 'kepler', 1530, 560, 110, { color: rgba(CC.cyan, 1), alpha: ga, reveal: smoothstep(beatTime(50), beatTime(54), t), glow: BL(10) });
      focus = sat;
    }
    hud(g, t, { alpha: smoothstep(1.6, 2.6, t), right: ['WORLDLINE  α', 'OBS  0001'] });
  };
  /* dive: into the satellite */
  if (io.exit != null && io.kind === 'dive') {
    g.save();
    const e = easeIn(io.exit), k = Math.exp(e * 4.2);
    const f0 = sat0(t);
    const cx = lerp(f0[0], W / 2, smooth(io.exit)), cy = lerp(f0[1], H / 2, smooth(io.exit));
    g.translate(cx, cy); g.scale(k, k); g.translate(-f0[0], -f0[1]);
    draw(); g.restore();
    phosDot(g, cx, cy, 10 + 30 * e, smooth(io.exit));
    return { focus: [cx, cy] };
  }
  draw();
  /* power-on: a bright line opens into the raster */
  if (t < 1.6) {
    const w = easeOut(smoothstep(0.15, 0.7, t)), h = easeInOut(smoothstep(0.7, 1.5, t));
    g.fillStyle = '#000';
    const hh = Math.max(2, h * H / 2);
    g.fillRect(0, 0, W, H / 2 - hh); g.fillRect(0, H / 2 + hh, W, H / 2 - hh);
    if (h < 1) { g.fillStyle = rgba('#eafff6', (1 - h) * 0.9); g.fillRect(W / 2 - w * W / 2, H / 2 - 2, w * W, 4); }
  }
  rasterJolt(g, t, 0.6 * smoothstep(3, 4, t));
  return { focus };
}
function sat0(t) {
  const R = lerp(150, 250, easeOut(smoothstep(beatTime(42), beatTime(52), t)));
  return satPos(globePts(t, W / 2, 600, R, t * 0.25, 0.42), t).p;
}
/* Generic A wrapper. body(g, t) draws the scene and returns its dive focus
   (where the phosphor dot is). Handles surfacing in from C and diving out. */
function aScene(body, o = {}) {
  return (g, t, io) => {
    const run = () => { tube(g, t, o.tube ? o.tube(t) : {}); return body(g, t, io) || [W / 2, H / 2]; };
    if (io.exit != null && io.kind === 'dive') {
      /* first pass finds the focus, cheaply: draw once normally into a scratch transform */
      const f0 = o.focus ? o.focus(t) : [W / 2, H / 2];
      const e = easeIn(io.exit), k = Math.exp(e * 4.2);
      const cx = lerp(f0[0], W / 2, smooth(io.exit)), cy = lerp(f0[1], H / 2, smooth(io.exit));
      g.save(); g.translate(cx, cy); g.scale(k, k); g.translate(-f0[0], -f0[1]);
      run(); g.restore();
      phosDot(g, cx, cy, 10 + 30 * e, smooth(io.exit));
      return { focus: [cx, cy] };
    }
    if (io.enter != null && io.kind === 'surface' && io.from && io.from.focus) {
      const p = io.enter, f = io.from.focus;
      const k = lerp(0.03, 1, easeOut(smoothstep(0.15, 1, p)));
      const cx = lerp(f[0], W / 2, smooth(p)), cy = lerp(f[1], H / 2, smooth(p));
      g.save(); g.translate(cx, cy); g.scale(k, k); g.translate(-W / 2, -H / 2);
      run(); g.restore();
      phosDot(g, cx, cy, 14 * (1 - p) + 2, 1 - p);
      return {};
    }
    const f = run();
    if (!o.noHud) hud(g, t, o.hud ? o.hud(t) : {});
    rasterJolt(g, t, o.jolt ?? 0.8);
    return { focus: f };
  };
}

/* a shared chorus device: the 「０」|「１」 line with seven-segment windows and an axis */
function zeroOne(g, t, L, y, o = {}) {
  const lay = aLyric(g, L, t, { x: W / 2, y, size: o.size ?? 190, maxW: 1640, oneRow: true,
    colors: { '０': CC.amber, '１': CC.amber, '過': CC.cyan, '去': CC.cyan, '未': CC.phos, '来': CC.phos } });
  if (!lay) return null;
  const fade = 1 - smoothstep(L.off - 0.35, L.off, t);
  for (const q of lay.glyphs) {
    if (q.u.text !== '０' && q.u.text !== '１') continue;
    const a = smoothstep(q.u.t, q.u.t + 0.18, t) * fade;
    if (a <= 0) continue;
    brackets(g, W / 2 + q.x, y + q.y, q.w * 1.1, q.s * 1.25, rgba(CC.amber, 0.8), a);
    drawTex(g, q.u.text === '０' ? 'ket0' : 'ket1', W / 2 + q.x, y + q.y + q.s * 0.92, q.s * 0.3,
            { color: rgba(CC.amber, 1), alpha: a * 0.9 });
  }
  /* the axis between past and future: the 'present' that is nowhere */
  const sp = L.units.findIndex(u => u.text === ' ');
  const g1 = lay.glyphs.find(q => q.u === L.units[sp - 1]), g2 = lay.glyphs.find(q => q.u === L.units[sp + 1]);
  if (g1 && g2) {
    const xm = W / 2 + (g1.x + g1.w / 2 + g2.x - g2.w / 2) / 2;
    const a = smoothstep(L.units[sp + 1].t - 0.1, L.units[sp + 1].t + 0.25, t) * fade;
    g.save(); g.globalAlpha = a; g.strokeStyle = rgba(CC.cyan, 0.7); g.lineWidth = 2; g.shadowColor = CC.cyan; g.shadowBlur = BL(16);
    g.beginPath(); g.moveTo(xm, y - 180); g.lineTo(xm, y + 180); g.stroke();
    g.restore();
  }
  return lay;
}
/* 「今」は何処にもない : 今 is struck through by a red stroke, then the stroke cancels it */
function nowhere(g, t, L, y, o = {}) {
  const lay = aLyric(g, L, t, { x: W / 2, y, size: o.size ?? 200, maxW: 1640, oneRow: true, colors: { '今': CC.red } });
  if (!lay) return null;
  const q = lay.glyphs.find(q => q.u.text === '今');
  const a = smoothstep(q.u.t + 0.45, q.u.t + 0.85, t) * (1 - smoothstep(L.off - 0.3, L.off, t));
  if (a > 0) {
    const r = q.s * 0.6, x = W / 2 + q.x, yy = y + q.y, e = easeOut(a);
    g.save(); g.strokeStyle = rgba(CC.red, 0.95); g.lineWidth = 10; g.shadowColor = CC.red; g.shadowBlur = BL(30);
    g.beginPath(); g.moveTo(x - r, yy - r * 0.92); g.lineTo(x - r + 2 * r * e, yy - r * 0.92 + 2 * r * 0.92 * e); g.stroke();
    g.restore();
    /* the 'NOW' slot in the legend reads empty */
  }
  return lay;
}
/* 背く事の出来ぬ ロジック : a truth table that can't be broken, and ¬(P∧¬P) */
function logic(g, t, L, y, o = {}) {
  const lay = aLyric(g, L, t, { x: W / 2, y, size: o.size ?? 170, maxW: 1640 });
  if (!lay) return null;
  const ta = L.units.find(u => u.text === 'ロ').t;
  const a = smoothstep(ta - 0.1, ta + 0.4, t) * (1 - smoothstep(L.off - 0.35, L.off, t));
  if (a > 0) {
    drawTex(g, 'noncon', W / 2, y + 290, 92, { color: rgba(CC.amber, 1), alpha: a, reveal: smoothstep(ta, ta + 0.8, t), glow: BL(12) });
    /* truth table, lit row by row on the 16ths */
    const rows = [['P', '¬P', 'P∧¬P'], ['0', '1', '0'], ['1', '0', '0']];
    g.save(); g.globalAlpha = a * 0.85; g.font = `700 30px ${FONT_STACKS.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    rows.forEach((r, i) => r.forEach((c, j) => {
      const lit = t > ta + 0.15 * (i * 3 + j);
      g.fillStyle = rgba(i === 0 ? CC.cyan : j === 2 ? CC.red : CC.phos, lit ? 0.95 : 0.15);
      g.fillText(c, 1540 + j * 110, 160 + i * 44);
    }));
    g.restore();
  }
  return lay;
}

/* ---------- A2: chorus 1a / final chorus a (「０」が過去で… ロジック) ---------- */
function aChorusA(spec) {
  const L0 = LINES[spec.zero], L1 = LINES[spec.now], L2 = LINES[spec.logic];
  return aScene((g, t) => {
    /* the camera eases in through the three lines */
    const push = 1 + 0.04 * smoothstep(L0.first, L2.off, t);
    g.save(); zoomAbout(g, W / 2, H * 0.5, push);
    zeroOne(g, t, L0, 520);
    nowhere(g, t, L1, 540);
    logic(g, t, L2, 470);
    for (const L of [L0, L1, L2]) retrace(g, t, L.first);
    g.restore();
    return [W / 2, H / 2];
  }, {
    focus: () => [W / 2, 470 + 290],
    hud: t => ({ right: ['PAST   →  0', 'FUTURE →  1', t > L1.first + 0.5 ? 'NOW    →  ∅' : 'NOW    →  —'] }),
  });
}
/* ---------- Fourier epicycles: a square wave built one harmonic per beat ---------- */
function epicycles(g, t, cx, cy, R, nH, o = {}) {
  let x = cx, y = cy;
  const w = TAU / (8 * BEAT) * (o.speed ?? 1);
  g.save(); g.lineWidth = 1.5;
  for (let k = 0; k < Math.ceil(nH); k++) {
    const n = 2 * k + 1, r = R * 4 / (Math.PI * n) * clamp(nH - k, 0, 1);
    const a = n * w * t;
    g.strokeStyle = rgba(CC.phos, 0.22); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    const nx = x + r * Math.cos(a), ny = y + r * Math.sin(a);
    g.strokeStyle = rgba(CC.cyan, 0.8); g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
    x = nx; y = ny;
  }
  g.restore();
  return [x, y];
}
function fourierWave(g, t, x0, y0, R, nH, len = 900) {
  /* the trace the tip leaves behind, recomputed analytically, not stored */
  const w = TAU / (8 * BEAT);
  g.beginPath();
  for (let i = 0; i <= 300; i++) {
    const tt = t - i / 300 * 4 * BEAT;
    let yy = 0;
    for (let k = 0; k < Math.ceil(nH); k++) { const n = 2 * k + 1; yy += R * 4 / (Math.PI * n) * clamp(nH - k, 0, 1) * Math.sin(n * w * tt); }
    const X = x0 + i / 300 * len;
    i ? g.lineTo(X, y0 + yy) : g.moveTo(X, y0 + yy);
  }
  g.strokeStyle = rgba(CC.phos, 0.95); g.lineWidth = 3; g.shadowColor = CC.phos; g.shadowBlur = BL(14); g.stroke(); g.shadowBlur = 0;
}

/* a clock face with two hands, the face warped by 'warp' (relativity) */
function clock(g, t, cx, cy, R, warp, a) {
  g.save(); g.globalAlpha *= a;
  const wp = (x, y) => {                 // a lensing warp: pinch toward the centre-right
    const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) / R;
    const k = 1 - warp * 0.35 * Math.exp(-r * r * 1.4) - warp * 0.12 * Math.sin(Math.atan2(dy, dx) * 2 + t);
    return [cx + dx * k, cy + dy * k];
  };
  g.lineWidth = 3; g.strokeStyle = rgba(CC.phos, 0.85);
  g.beginPath();
  for (let i = 0; i <= 120; i++) { const th = i / 120 * TAU; const p = wp(cx + R * Math.cos(th), cy + R * Math.sin(th)); i ? g.lineTo(...p) : g.moveTo(...p); }
  g.stroke();
  for (let i = 0; i < 60; i++) {
    const th = i / 60 * TAU, r0 = i % 5 ? 0.92 : 0.84;
    const p0 = wp(cx + R * r0 * Math.cos(th), cy + R * r0 * Math.sin(th)), p1 = wp(cx + R * 0.98 * Math.cos(th), cy + R * 0.98 * Math.sin(th));
    g.lineWidth = i % 5 ? 1.5 : 3.5; g.strokeStyle = rgba(i % 15 ? CC.phos : CC.amber, 0.8);
    g.beginPath(); g.moveTo(...p0); g.lineTo(...p1); g.stroke();
  }
  /* the two hands: one per bar, one per beat; the warped clock runs slow */
  const slow = 1 - 0.45 * warp;
  const hands = [[beatAt(t) / 16 * slow, 0.55, 9, CC.amber], [beatAt(t) / 4 * slow, 0.82, 5, CC.cyan]];
  for (const [ph, len, lw, col] of hands) {
    const th = ph * TAU - Math.PI / 2;
    const p = wp(cx + R * len * Math.cos(th), cy + R * len * Math.sin(th));
    g.lineWidth = lw; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = BL(14);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(...p); g.stroke(); g.shadowBlur = 0;
  }
  g.fillStyle = CC.white; g.beginPath(); g.arc(cx, cy, 8, 0, TAU); g.fill();
  g.restore();
}

/* ---------- A3: interlude (Fourier) + verse 2 first half (二つの針 / 歪み) ---------- */
function aInterlude(spec) {
  const L1 = LINES[18], L2 = LINES[19];
  const t0 = spec.t0, tV = L1.first - 0.6;
  return aScene((g, t) => {
    /* part 1: the Fourier build, one harmonic per beat */
    const fa = 1 - smoothstep(tV - 1.2, tV, t);
    let tip = [W / 2, H / 2];
    if (fa > 0) {
      const nH = clamp(1 + (beatAt(t) - beatAt(t0 + 0.4)) / 2, 1, 14);
      g.save(); g.globalAlpha = fa;
      tip = epicycles(g, t, 470, 520, 150, nH);
      g.strokeStyle = rgba(CC.cyan, 0.5); g.setLineDash([4, 8]); g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(860, tip[1]); g.stroke(); g.setLineDash([]);
      fourierWave(g, t, 860, 520, 150, nH, 920);
      drawTex(g, 'fseries', W / 2, 860, 120, { color: rgba(CC.cyan, 1), reveal: smoothstep(t0 + 0.5, t0 + 3, t), glow: BL(12) });
      g.font = `700 30px ${FONT_STACKS.mono}`; g.fillStyle = rgba(CC.amber, 0.9); g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(`N = ${String(Math.ceil(nH)).padStart(2, '0')}`, 300, 300);
      g.restore();
    }
    /* part 2: the clock. 二つの針が指す 時間の概念も / 観測者しだいで 歪みを見せる */
    const ca = smoothstep(tV - 1.2, tV, t);
    if (ca > 0) {
      const warp = easeInOut(smoothstep(L2.units.find(u => u.text === '歪').t - 0.2, L2.off, t));
      clock(g, t, W / 2, 470, 300 * lerp(0.6, 1, easeOut(ca)), warp, ca);
      aLyric(g, L1, t, { x: W / 2, y: 870, size: 128, maxW: 1700, oneRow: true });
      const lay = aLyric(g, L2, t, { x: W / 2, y: 870, size: 128, maxW: 1700, oneRow: true,
        motion: (q, s, x, y) => {             // 歪み: the line itself bends
          const w = warp * 40 * Math.sin((x - W / 2) * 0.006 + t * 2);
          return { x, y: y + w - 30 * s.ex, rot: warp * 0.12 * Math.cos((x - W / 2) * 0.006), sc: s.k, a: s.a };
        } });
      drawTex(g, 'dilation', 1550, 200, 96, { color: rgba(CC.cyan, 1), alpha: warp, reveal: warp, glow: BL(10) });
      drawTex(g, 'interval', 400, 200, 52, { color: rgba(CC.cyan, 1), alpha: ca * 0.8, reveal: smoothstep(L1.first, L1.first + 1, t), glow: BL(10) });
    }
    return [W / 2, 470];
  }, { focus: () => [W / 2, 470], hud: t => ({ right: ['HARMONICS', 'Σ sin((2n−1)x)/(2n−1)'] }) });
}

/* ---------- A4: chorus 2b (Open the eyes / 秩序のない理論 / 無限 / 不正 / 再生) ---------- */
function logistic(g, t, r0, r1, rev, box) {
  /* the bifurcation diagram, revealed left to right; fixed iterations, seeded start */
  const { x, y, w, h } = box, cols = Math.floor(w / 3 * rev);
  g.fillStyle = rgba(CC.phos, 0.55);
  for (let i = 0; i < cols; i++) {
    const r = lerp(r0, r1, i / (w / 3));
    let v = 0.5;
    for (let k = 0; k < 160; k++) v = r * v * (1 - v);
    for (let k = 0; k < 48; k++) { v = r * v * (1 - v); g.fillRect(x + i * 3, y + h - v * h, 1.6, 1.6); }
  }
}
function vectorEye(g, t, t0, cx, cy, r, col) {
  const op = easeOut(smoothstep(t0, t0 + 0.45, t));
  if (op <= 0) return;
  g.save(); g.strokeStyle = col; g.lineWidth = 4; g.shadowColor = col; g.shadowBlur = BL(20);
  g.beginPath(); g.moveTo(cx - r * 1.7, cy);
  g.quadraticCurveTo(cx, cy - r * 1.3 * op, cx + r * 1.7, cy); g.quadraticCurveTo(cx, cy + r * 1.3 * op, cx - r * 1.7, cy); g.stroke();
  g.beginPath(); g.arc(cx, cy, r * 0.62 * op, 0, TAU); g.stroke();
  g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r * 0.25 * op, 0, TAU); g.fill();
  g.restore();
}
function aChorus2b(spec) {
  const Lo = LINES[30], L1 = LINES[31], L2 = LINES[32], L3 = LINES[33], L4 = LINES[34], L5 = LINES[35];
  return aScene((g, t) => {
    /* Open the eyes: the eye opens over the whole tube */
    if (t < L1.off) {
      const a = 1 - smoothstep(L1.first + 0.4, L1.first + 1.4, t);
      if (a > 0) { g.save(); g.globalAlpha = a; vectorEye(g, t, Lo.first, W / 2, 480, 240, CC.phos); g.restore(); }
      aLyric(g, Lo, t, { x: W / 2, y: 860, size: 120, maxW: 1200, colorOf: () => CC.amber });
    }
    /* 宇宙がまだ隠し持った / 秩序のない理論 : the bifurcation diagram fills in */
    const ba = smoothstep(L1.first, L1.first + 0.6, t) * (1 - smoothstep(L4.first - 0.4, L4.first + 0.2, t));
    if (ba > 0) {
      g.save(); g.globalAlpha = ba;
      logistic(g, t, 2.8, 4.0, easeOut(smoothstep(L1.first, L2.off, t)), { x: 260, y: 130, w: 1400, h: 520 });
      drawTex(g, 'logistic', 1500, 720, 70, { color: rgba(CC.cyan, 1), reveal: smoothstep(L2.first, L2.first + 0.6, t), glow: BL(10) });
      /* 無限と呼ばれた点と点が : Feigenbaum points marked, one per beat, converging */
      const fr = [3.0, 3.44949, 3.54409, 3.5644, 3.56876, 3.56969];
      fr.forEach((r, i) => {
        const tt = L3.first + i * BEAT; if (t < tt) return;
        const x = 260 + (r - 2.8) / 1.2 * 1400, a2 = smoothstep(tt, tt + 0.15, t);
        g.strokeStyle = rgba(CC.amber, 0.9 * a2); g.lineWidth = 2; g.beginPath(); g.moveTo(x, 130); g.lineTo(x, 650); g.stroke();
        g.fillStyle = rgba(CC.amber, a2); g.beginPath(); g.arc(x, 650, 7, 0, TAU); g.fill();
      });
      if (t > L3.first) drawTex(g, 'feig', 640, 760, 80, { color: rgba(CC.amber, 1), reveal: smoothstep(L3.first + 0.4, L3.first + 1.6, t), glow: BL(10) });
      g.restore();
    }
    aLyric(g, L1, t, { x: W / 2, y: 900, size: 132, maxW: 1700, oneRow: true });
    aLyric(g, L2, t, { x: W / 2, y: 900, size: 150, maxW: 1700, oneRow: true, colors: { '秩': CC.red, '序': CC.red } ,
      motion: (q, s, x, y, i) => ({ x: x + (q.u.text === '秩' || q.u.text === '序' ? 0 : 0), y: y + Math.sin(i * 2.3 + t * 9) * 6 * smoothstep(L2.first, L2.first + 1, t) - 30 * s.ex, rot: 0, sc: s.k, a: s.a }) });
    aLyric(g, L3, t, { x: W / 2, y: 900, size: 132, maxW: 1700, oneRow: true, colors: { '点': CC.amber, '無': CC.cyan, '限': CC.cyan } });
    /* 不正な力を借りて : the tube glitches, then 「再生」をする rewinds everything */
    const rw = smoothstep(L5.first, L5.first + 0.3, t) * (1 - smoothstep(L5.off - 0.6, L5.off, t));
    const lay4 = aLyric(g, L4, t, { x: W / 2, y: 520, size: 190, maxW: 1640, colors: { '不': CC.red, '正': CC.red, '力': CC.red },
      motion: (q, s, x, y, i) => ({ x: x + (hash1(Math.floor(t * 20) * 7 + i) - 0.5) * 30 * smoothstep(L4.first, L4.off, t), y: y - 30 * s.ex, rot: 0, sc: s.k, a: s.a }) });
    if (t > L5.on) {
      /* 再生: playback — the frame counter runs backwards, the lyric draws in mirrored time */
      aLyric(g, L5, t, { x: W / 2, y: 520, size: 230, maxW: 1640, colors: { '再': CC.amber, '生': CC.amber } });
      g.save(); g.globalAlpha = rw;
      g.fillStyle = CC.amber;
      const cx = W / 2, cy = 820;
      for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(cx - 10 - k * 60, cy); g.lineTo(cx + 40 - k * 60, cy - 34); g.lineTo(cx + 40 - k * 60, cy + 34); g.closePath(); g.fill(); }
      g.restore();
    }
    retrace(g, t, L4.first); retrace(g, t, L5.first);
    return [W / 2, 520];
  }, {
    focus: () => [W / 2, 520],
    hud: t => {
      const rewind = t > LINES[35].first ? (LINES[35].first - (t - LINES[35].first) * 3.2) : t;
      return { tc: rewind, right: ['CHAOS  r ∈ [2.8, 4.0]', 'δ = 4.6692…'] };
    },
  });
}
/* ---------- A5: the finale. 景色は / 「収束」をする / outro / power-off ---------- */
/* golden-rectangle tiling, cut 34 times; the eye is the limit point */
const GT = (() => {
  /* each cut removes a square and leaves a golden rectangle turned a quarter;
     the arc is centred on the square's inner corner */
  let x = 0, y = 0, w = 1, h = 1 / ((1 + Math.sqrt(5)) / 2);
  const sq = [];
  for (let k = 0; k < 34; k++) {
    const d = k % 4;
    if (d === 0) { sq.push({ x, y, s: h, a0: Math.PI, cx: x + h, cy: y + h }); x += h; w -= h; }
    else if (d === 1) { sq.push({ x, y, s: w, a0: -Math.PI / 2, cx: x, cy: y + w }); y += w; h -= w; }
    else if (d === 2) { sq.push({ x: x + w - h, y, s: h, a0: 0, cx: x + w - h, cy: y }); w -= h; }
    else { sq.push({ x, y: y + h - w, s: w, a0: Math.PI / 2, cx: x + w, cy: y + h - w }); h -= w; }
  }
  return { sq, ex: x + w / 2, ey: y + h / 2 };
})();
const PHIc = (1 + Math.sqrt(5)) / 2;
function goldenZoom(g, t, u, a) {
  /* magnify by φ per unit u about the eye, rotating a quarter turn: self-similar */
  const fu = u - Math.floor(u), m = Math.floor(u);
  const base = 7200;
  g.save(); g.globalAlpha *= a;
  g.translate(W / 2, H / 2);
  g.rotate(-fu * Math.PI / 2);
  g.scale(base * Math.pow(PHIc, fu), base * Math.pow(PHIc, fu));
  g.translate(-GT.ex, -GT.ey);
  const px = 1 / (base * Math.pow(PHIc, fu));         // one logical px in tiling units
  for (let k = 0; k < GT.sq.length; k++) {
    const q = GT.sq[k], sz = q.s / px;
    if (sz < 1.5) break;
    g.lineWidth = 1.6 * px; g.strokeStyle = rgba(CC.phos, 0.35);
    g.strokeRect(q.x, q.y, q.s, q.s);
    g.lineWidth = 4 * px; g.strokeStyle = rgba(CC.amber, 0.95); g.shadowColor = CC.amber; g.shadowBlur = BL(14);
    g.beginPath(); g.arc(q.cx, q.cy, q.s, q.a0, q.a0 + Math.PI / 2); g.stroke(); g.shadowBlur = 0;
    if (sz > 120 && sz < 2600) {
      const n = k + m + 1;                              // depth label: F_n grows as we go in
      g.save(); g.translate(q.x + q.s / 2, q.y + q.s / 2); g.rotate(fu * Math.PI / 2); g.scale(px, px);
      g.font = `700 ${clamp(sz * 0.16, 18, 120)}px ${FONT_STACKS.latin}`; g.fillStyle = rgba(CC.phos, 0.6);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(FIB[Math.min(n, FIB.length - 1)]), 0, 0);
      g.restore();
    }
  }
  g.restore();
}

function aFinale(spec) {
  const LK = LINES[44], LS = LINES[45];
  const tZ0 = LS.last + 0.6, tSlow = 254.2, tOff = 266.0;
  const TAUs = 2.6;
  const uOf = t => {
    if (t < tZ0) return 0;
    if (t < tSlow) return (t - tZ0) / BAR;
    return (tSlow - tZ0) / BAR + TAUs / BAR * (1 - Math.exp(-(t - tSlow) / TAUs));
  };
  const morae = LS.units.filter(u => u.sung).map(u => u.t);
  const lockT = k => lerp(LS.first, LS.last + 0.5, k / 7);
  return aScene((g, t) => {
    /* the converging traces: 13 worldlines on the scope, each mora shrinks the spread by 1/φ */
    let k = 0; for (const m of morae) k += smoothstep(m, m + 0.25, t);
    const conv = 1 - Math.pow(1 / PHIc, k * 1.6) * (1 - smoothstep(LS.last + 0.3, tZ0, t));
    const spread = 1 - clamp(conv, 0, 1);
    const ta = 1 - smoothstep(tZ0, tZ0 + 1.6, t);
    if (ta > 0) {
      for (let i = 0; i < 13; i++) {
        const off = (i - 6) * 62 * spread, f = 0.0035 + i * 0.0007, ph = i * 1.37 + t * (0.8 + i * 0.05);
        g.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = 540 + off + spread * (Math.sin(x * f + ph) * 34 + Math.sin(x * f * 2.7 - ph) * 12);
          x ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        const hot = i === 6;
        g.strokeStyle = rgba(hot ? CC.amber : CC.phos, (hot ? 0.95 : 0.55) * ta); g.lineWidth = hot ? 3.5 : 2;
        g.shadowColor = hot ? CC.amber : CC.phos; g.shadowBlur = BL(10); g.stroke(); g.shadowBlur = 0;
      }
    }
    /* その目に映る景色は */
    aLyric(g, LK, t, { x: W / 2, y: 230, size: 140, maxW: 1700, oneRow: true });
    /* 「収束」をする — huge, on the line the traces converge into */
    aLyric(g, LS, t, { x: W / 2, y: 540, size: 290, maxW: 1700, oneRow: true, offAt: tZ0 + 1.2, exitDur: 1.0,
      colors: { '収': CC.white, '束': CC.white },
      motion: (q, s, x, y) => ({ x, y: y - 6 * (1 - Math.exp(-Math.max(s.dt, 0) * 1.5)), rot: 0, sc: s.k * (1 - 0.25 * s.ex), a: s.a }) });
    if (t > LS.first) drawTex(g, 'epsN', W / 2, 880, 64, { color: rgba(CC.cyan, 1), reveal: smoothstep(LS.first + 0.3, LS.first + 2.0, t),
      alpha: 1 - smoothstep(tZ0, tZ0 + 1.2, t), glow: BL(10) });
    /* outro: the golden zoom, converging on the eye of the spiral */
    const za = smoothstep(tZ0 - 0.2, tZ0 + 1.4, t) * (1 - smoothstep(tOff - 3, tOff, t));
    if (za > 0) {
      goldenZoom(g, t, uOf(t), za);
      const n = Math.floor(uOf(t)) + 8;
      const r = FIB[Math.min(n + 1, FIB.length - 1)] / FIB[Math.min(n, FIB.length - 1)];
      g.save(); g.globalAlpha = za;
      drawTex(g, 'fibconv', 1500, 960, 66, { color: rgba(CC.cyan, 1), glow: BL(8) });
      g.font = `700 40px ${FONT_STACKS.latin}`; g.fillStyle = rgba(CC.amber, 0.95); g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(`F(${n + 1}) / F(${n}) = ${r.toFixed(10)}`, 120, 960);
      g.restore();
    }
    /* the last dot: everything converged on one point */
    const da = smoothstep(tOff - 3, tOff - 0.5, t);
    if (da > 0) phosDot(g, W / 2, H / 2, 10, da);
    const tt = smoothstep(tOff - 2, tOff, t) * (1 - smoothstep(269.5, 270.5, t));
    if (tt > 0) {
      g.save(); g.globalAlpha = tt; g.font = fontOf('mincho', 54); g.fillStyle = CC.pale; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = CC.phos; g.shadowBlur = BL(14);
      g.fillText(TITLE, W / 2, 760);
      g.font = fontOf('meiryo', 30); g.fillStyle = CC.cyan; g.fillText('いとうかなこ', W / 2, 830);
      g.restore();
    }
    return [W / 2, H / 2];
  }, {
    tube: t => ({ traces: 0, amp: 0 }),
    hud: t => {
      /* the divergence meter locks digit by digit: the observer finally settles */
      const target = '1.048596', live = divValue(t).toFixed(6);
      let s = '';
      for (let i = 0; i < target.length; i++) {
        const locked = t > lockT(i);
        s += locked ? target[i] : (target[i] === '.' ? '.' : String(Math.floor(hash1(Math.floor(t * 30) * 13 + i) * 10)));
      }
      return { divText: t > LS.first ? s : live, label: t > lockT(7) ? 'DIVERGENCE · LOCKED' : 'DIVERGENCE',
               alpha: 1 - smoothstep(tOff, tOff + 1, t), right: ['n → ∞'] };
    },
    jolt: 0.5,
    post: true,
  });
}

/* the CRT switch-off, drawn over everything at the very end */
function powerOff(g, t, t0) {
  if (t < t0) return;
  const p1 = easeIn(smoothstep(t0, t0 + 0.35, t)), p2 = easeIn(smoothstep(t0 + 0.35, t0 + 0.7, t));
  const hh = lerp(H / 2, 2, p1), ww = lerp(W / 2, 3, p2);
  g.save(); g.globalCompositeOperation = 'source-over';
  /* everything outside the collapsing slit goes black; the slit is bright */
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H / 2 - hh); g.fillRect(0, H / 2 + hh, W, H / 2 - hh);
  g.fillRect(0, 0, W / 2 - ww, H); g.fillRect(W / 2 + ww, 0, W / 2 - ww, H);
  const glow = smoothstep(t0, t0 + 0.4, t) * (1 - smoothstep(t0 + 0.9, t0 + 2.6, t));
  g.fillStyle = rgba('#eafff6', glow);
  g.fillRect(W / 2 - ww, H / 2 - Math.max(1.5, hh), ww * 2, Math.max(3, hh * 2));
  if (t > t0 + 0.6) phosDot(g, W / 2, H / 2, 6, glow);
  g.restore();
}
