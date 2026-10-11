/* ===================================================================
   Revision 2 scenes:
     cTitle   — the opening as a worldline flight, title + credits written on
                the plane of the present
     aVerse   — CRT verse scenes with one instrument per line (replaces the
                early C verses)
     bFlash   — a riso page for quick hard-cut inserts
     bgPrint  — the faint riso print that sits behind the CRT verses
   =================================================================== */

/* ---------- the opening title: worldline flight ---------- */
const CREDITS = [
  { text: 'スカイクラッドの観測者', at: beatTime(16), size: 170, face: 'mincho', col: '#f2f7ff', dy: 0 },
  { text: 'いとうかなこ', at: beatTime(28), size: 92, face: 'meiryo', col: '#cfe8ff', dy: 210 },
  { text: '作詞・作曲　志倉千代丸', at: beatTime(40), size: 54, face: 'ud', col: '#ffd9c8', dy: 330 },
  { text: 'STEINS;GATE  OPENING THEME', at: beatTime(48), size: 40, face: 'latin', col: '#ffb347', dy: 410 },
];
/* a credit line built as a pseudo-lyric so it gets the same per-glyph strike */
const CREDIT_L = CREDITS.map((c, k) => {
  const chars = [...c.text];
  const step = Math.min(BEAT / 2, (beatTime(8) - 0.2) / chars.length);
  const L = { i: 950 + k, latin: false, jp: c.text,
              units: chars.map((ch, j) => ({ text: ch, t: c.at + j * step, sung: ch !== ' ' && ch !== '　' })) };
  L.on = c.at - 0.05; L.off = 1e9; L.first = c.at; L.last = L.units[chars.length - 1].t; L.end = L.last;
  return L;
});

function cTitle() {
  const Wd = makeWorld({ t0: -2, t1: 28, V: 360, ahead: 1000, seed: 5, spread: 120, sub: 3,
                         splits: splitsEvery(beatTime(8), 25.5, 2) });
  return (g, t, io) => {
    let ct = chaseCT(Wd, t, { offset: [40, 70] });
    /* a slow crane: wide and high early, settling into the chase */
    const w = 1 - easeInOut(smoothstep(2, 14, t));
    if (w > 0) {
      const fz = Wd.frontier(t), hp = Wd.chosenAt(fz).p;
      ct = blendCT(ct, { C: [hp[0] + 600, hp[1] + 700, fz - 2600], T: [hp[0], hp[1] + 80, fz], roll: 0.05 }, w);
    }
    let zoom = 1, surf = 0;
    if (io.exit != null && io.kind === 'surface') {
      surf = easeInOut(io.exit);
      const fz = Wd.frontier(t), hp = Wd.chosenAt(fz).p;
      ct = blendCT(ct, { C: [hp[0] + 30, hp[1] + 40, fz - 5200], T: [hp[0], hp[1], fz], roll: 0 }, surf);
      zoom = lerp(1, 0.55, surf);
    }
    const cam = camOf(ct, zoom);
    drawSky(g, t, cam);
    drawWorldlines(g, Wd, t, cam, { branchA: (1 - 0.7 * surf) * smoothstep(beatTime(8), beatTime(12), t), wave: 1.2 });
    /* the credits are a fixed panel in screen space, so they stay readable */
    const fade = 1 - smoothstep(22.6, 24.0, t);
    if (fade > 0) {
      /* a dark plate under the credits so the worldlines never cut through the type */
      g.save(); g.globalCompositeOperation = 'source-over';
      const pa = fade * smoothstep(beatTime(15), beatTime(17), t);
      const rg = g.createRadialGradient(W / 2, 470, 60, W / 2, 470, 900);
      rg.addColorStop(0, `rgba(2,4,10,${0.85 * pa})`); rg.addColorStop(0.55, `rgba(2,4,10,${0.6 * pa})`); rg.addColorStop(1, 'rgba(2,4,10,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.restore();
      g.save(); g.globalAlpha = fade;
      CREDIT_L.forEach((L, k) => {
        const c = CREDITS[k];
        drawLyric(g, L, t, { x: W / 2, y: 300 + c.dy, size: c.size, maxW: 1700, oneRow: true, keep: true,
          colorOf: () => c.col, glow: k === 0 ? 0.12 : 0.06, flash: 0.7, pop: 0.3,
          fontOverride: c.face });
      });
      g.restore();
    }
    hud(g, t, { alpha: 0.7 * smoothstep(1.0, 2.0, t) * fade, right: ['WORLDLINE  α', 'OBS  0001'] });
    if (t < 1.6) {                                       // power-on, as before
      const wv = easeOut(smoothstep(0.15, 0.7, t)), h = easeInOut(smoothstep(0.7, 1.5, t));
      const hh = Math.max(2, h * H / 2);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H / 2 - hh); g.fillRect(0, H / 2 + hh, W, H / 2 - hh);
      if (h < 1) { g.fillStyle = rgba('#eafff6', (1 - h) * 0.9); g.fillRect(W / 2 - wv * W / 2, H / 2 - 2, wv * W, 4); }
    }
    const out = {};
    if (io.exit != null && io.kind === 'surface') {
      const hd = headOnScreen(Wd, t, cam);
      out.focus = hd ? [hd.x, hd.y] : [W / 2, H / 2];
      if (hd) phosDot(g, hd.x, hd.y, lerp(6, 14, surf), surf, '#ffffff');
    }
    return out;
  };
}

/* ---------- CRT verse: lines + one instrument per line ----------
   spec.items: [{ line, y, size, draw?(g,t,L), tex?, texAt?, colors? }] */
function aVerse(spec) {
  return aScene((g, t) => {
    const push = 1 + 0.035 * smoothstep(spec.t0, spec.t1, t);
    g.save(); zoomAbout(g, W / 2, H * 0.5, push);
    for (const it of spec.items) {
      const L = LINES[it.line];
      const live = t > L.on - 0.3 && t < L.off + 0.6;
      if (it.draw && (it.always || live)) it.draw(g, t, L);
      if (it.tex && t > (it.texAt ?? L.first)) {
        const a = smoothstep(it.texAt ?? L.first, (it.texAt ?? L.first) + 0.3, t) * (1 - smoothstep(L.off - 0.2, L.off + 0.4, t));
        if (a > 0) drawTex(g, it.tex, it.tx ?? W / 2, it.ty ?? 860, it.th ?? 84,
          { color: rgba(it.texCol || CC.cyan, 1), alpha: a, reveal: smoothstep(it.texAt ?? L.first, (it.texAt ?? L.first) + 0.9, t), glow: BL(10) });
      }
      const lo = { x: it.x ?? W / 2, y: it.y ?? 500, size: it.size ?? 176, maxW: it.maxW ?? 1680, oneRow: it.oneRow || L.latin, colors: it.colors };
      if (L.latin) lo.colorOf = () => CC.amber;
      if (it.motion) lo.motion = (q, s, x, y, i, lay) => it.motion(q, s, x, y, i, lay, t, L);
      if (it.align) lo.align = it.align;
      if (it.cam) { g.save(); it.cam(g, t, L); }
      aLyric(g, L, t, lo);
      if (it.cam) g.restore();
      retrace(g, t, L.first);
    }
    g.restore();
    return spec.focus || [W / 2, H / 2];
  }, { focus: () => spec.focus || [W / 2, H / 2], hud: t => ({ right: spec.right || [] }) });
}

/* small instruments for the verses */
function scopeArrow(g, t, L, dir) {
  /* 過去は離れて行き / 未来は近づく: a trace sliding away / toward the eye */
  const k = smoothstep(L.first, L.off, t);
  g.save(); g.strokeStyle = rgba(CC.cyan, 0.7); g.lineWidth = 3; g.shadowColor = CC.cyan; g.shadowBlur = BL(10);
  for (let i = 0; i < 9; i++) {
    const s = dir < 0 ? Math.pow(0.82, i + k * 3) : Math.pow(0.82, 8 - i - k * 3 + 3);
    const w = 1500 * s, hgt = 520 * s;
    g.globalAlpha = 0.12 + 0.5 * (1 - i / 9);
    g.strokeRect(W / 2 - w / 2, 520 - hgt / 2, w, hgt);
  }
  g.restore();
}
function balance(g, t, L) {
  /* 完全なるもので 絶対の均衡: a beam balance, swinging into perfect level */
  const dt = Math.max(0, t - L.first), ang = 0.32 * Math.exp(-dt * 0.9) * Math.cos(dt * 4.2);
  const cx = W / 2, cy = 820;
  g.save(); g.strokeStyle = rgba(CC.amber, 0.9); g.lineWidth = 4; g.shadowColor = CC.amber; g.shadowBlur = BL(12);
  g.beginPath(); g.moveTo(cx, cy + 150); g.lineTo(cx, cy - 10); g.stroke();
  g.translate(cx, cy - 10); g.rotate(ang);
  g.beginPath(); g.moveTo(-460, 0); g.lineTo(460, 0); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 460, 0); g.lineTo(s * 420, 90); g.lineTo(s * 500, 90); g.closePath(); g.stroke(); }
  g.restore();
}
function godEye(g, t, L) {
  /* 神の創り出した世界は: the observer's globe, ringed by a slow orbit */
  const a = smoothstep(L.first, L.first + 0.6, t);
  const P = drawGlobe(g, t, W / 2, 560, 300, a * 0.55);
  const s = satPos(P, t);
  g.save(); g.globalAlpha = a; g.fillStyle = CC.amber; g.fillRect(s.p[0] - 5, s.p[1] - 5, 10, 10); g.restore();
}
function coincidence(g, t, L) {
  /* それは折り重なる偶然: random dots fall into a Gaussian — chance folding into order */
  const n = Math.floor(clamp((t - L.first) * 140, 0, 420));
  g.save(); g.fillStyle = rgba(CC.phos, 0.75);
  g.globalAlpha = 1 - smoothstep(L.off - 0.3, L.off + 0.3, t);
  const cols = new Array(60).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0; for (let j = 0; j < 12; j++) s += hash1(i * 13 + j * 7919) > 0.5 ? 1 : 0;
    const c = clamp(Math.round(s / 12 * 59), 0, 59); cols[c]++;
    g.fillRect(360 + c * 20, 990 - cols[c] * 3.2, 16, 2.4);
  }
  g.restore();
}
function cosmos(g, t, L) {
  /* 宇宙規模の奇跡: a spiral galaxy of phosphor dots, turning */
  const a = smoothstep(L.first, L.first + 0.5, t);
  g.save(); g.globalAlpha = a * 0.8; g.fillStyle = CC.pale;
  for (let i = 0; i < 1400; i++) {
    const arm = i % 2, r = Math.pow(hash1(i * 3 + 1), 0.6) * 520;
    const th = arm * Math.PI + r * 0.011 + t * 0.35 + (hash1(i * 3 + 2) - 0.5) * 0.6;
    g.fillRect(W / 2 + Math.cos(th) * r, 520 + Math.sin(th) * r * 0.42, 2, 2);
  }
  g.restore();
}
function contradiction(g, t, L) {
  /* 矛盾に気付く: a check digit flips — a red ERROR stamp lands on 矛盾 */
  const u = L.units.find(q => q.text === '矛'); if (!u || t < u.t) return;
  const e = easeOut(smoothstep(u.t, u.t + 0.25, t));
  g.save(); g.globalAlpha = e * (1 - smoothstep(L.off - 0.3, L.off, t));
  g.strokeStyle = rgba(CC.red, 0.9); g.lineWidth = 4;
  g.strokeRect(W / 2 - 640, 780, 1280, 120);
  g.font = `700 64px ${FONT_STACKS.mono}`; g.fillStyle = CC.red; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('ASSERTION FAILED : P ∧ ¬P', W / 2, 840);
  g.restore();
}
function horizon(g, t, L, s = 1) {
  /* 必ず「果て」がある: a black hole drawn as a CRT schematic */
  const a = smoothstep(L.first - 0.3, L.first + 0.6, t) * s;
  if (a <= 0) return;
  const cx = W / 2, cy = 560, R = 150;
  g.save(); g.globalAlpha = a;
  for (let k = 0; k < 18; k++) {                 // the lensed grid, sucked toward the hole
    g.strokeStyle = rgba(CC.phos, 0.18); g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const x = 160 + i * 20, y0 = 200 + k * 42, dx = x - cx, dy = y0 - cy, r = Math.hypot(dx, dy) + 1;
      const pull = R * R * 2.2 / r;
      i ? g.lineTo(x - dx / r * pull * 0.3, y0 - dy / r * pull) : g.moveTo(x, y0);
    }
    g.stroke();
  }
  g.fillStyle = '#000'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
  g.strokeStyle = CC.amber; g.lineWidth = 4; g.shadowColor = CC.amber; g.shadowBlur = BL(22);
  g.beginPath(); g.arc(cx, cy, R * 1.05, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(cx, cy, R * 2.4, R * 0.5, -0.12, 0, TAU); g.stroke();
  g.restore();
}

function parallelLines(g, t, L) {
  /* 並行する無数の線: traces multiply on the scope, one more per beat */
  const n = clamp(Math.floor(beatAt(t) - beatAt(L.first)) + 1, 1, 24);
  g.save(); g.lineWidth = 1.8;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 26, ph = i * 1.9 + t * (0.7 + i * 0.04);
    g.strokeStyle = rgba(i === 0 ? CC.amber : CC.phos, i === 0 ? 0.9 : 0.35);
    g.beginPath();
    for (let x = 0; x <= W; x += 10) { const y = 520 + off + Math.sin(x * 0.004 + ph) * 30; x ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  }
  g.restore();
}
function doubt(g, t, L) {
  /* 僕らの「存在」さえ疑う: the observer's own readout flickers between 0 and 1 */
  const a = smoothstep(L.first, L.first + 0.3, t);
  g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 46px ${FONT_STACKS.mono}`;
  const bit = hash1(Math.floor(t * 12) * 17) < 0.5 ? 0 : 1;
  g.fillStyle = bit ? CC.amber : CC.red;
  g.fillText(`EXISTS(OBSERVER) = ${bit}`, W / 2, 250);
  g.restore();
}

/* ---------- B: quick riso inserts ---------- */
function bFlash(spec) {
  /* spec.kind: 'fib' | 'circuit' | 'wave' | 'tree' ; spec.text: a big stamped word; spec.tex */
  return (g, t, io) => {
    bBegin(g);
    const dt = t - spec.t0;
    folio(g, t, spec.page ?? 7, spec.head || 'OBSERVATION LOG');
    if (spec.kind === 'fib') {
      /* a golden spiral of squares, printed in two inks */
      let x = 1180, y = 200, s = 520;
      for (let k = 0; k < 9; k++) {
        g.fillStyle = k % 2 ? IB(0.35) : IA(0.25); g.fillRect(x, y, s, s);
        g.strokeStyle = IB(1); g.lineWidth = 4; g.strokeRect(x, y, s, s);
        const d = k % 4, s2 = s / PHI;
        if (d === 0) { x += s - s2 + 0; y += s; } else if (d === 1) { x -= s2; y += s - s2; } else if (d === 2) { y -= s2; } else { x += s; }
        s = s2;
        if (x < 900 || y > 1000) break;
      }
    } else if (spec.kind === 'circuit') {
      circuit(g, t, spec.t0 - 6 * BEAT, { x: 860, results: [1, 1, 0] });
    } else if (spec.kind === 'wave') {
      for (let k = 0; k < 6; k++) {
        g.strokeStyle = k === 2 ? IA(1) : IB(0.8); g.lineWidth = k === 2 ? 9 : 4; g.beginPath();
        for (let x = 900; x <= 1800; x += 6) {
          const y = 300 + k * 110 + Math.sin(x * 0.012 + k + dt * 6) * 40 * Math.exp(-(((x - 1350) / 380) ** 2));
          x === 900 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
    } else if (spec.kind === 'tree') {
      const br = (x, y, a, l, d) => {
        if (d > 7) return;
        const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
        g.strokeStyle = d % 2 ? IB(1) : IA(1); g.lineWidth = 12 - d * 1.4;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        br(x2, y2, a - 0.42, l * 0.72, d + 1); br(x2, y2, a + 0.42, l * 0.72, d + 1);
      };
      br(1350, 1000, -Math.PI / 2, 220, 0);
    }
    if (spec.text) {
      g.font = fontOf(spec.face || 'gothic', spec.size || 300); g.textAlign = 'left'; g.textBaseline = 'middle';
      const conv = Math.exp(-dt * 7) * 40;
      g.fillStyle = IB(1); g.fillText(spec.text, 130 - conv, 560 + conv * 0.5);
      g.fillStyle = IA(1); g.fillText(spec.text, 130 + conv, 560 - conv * 0.5);
    }
    if (spec.tex) drawTex(g, spec.tex, 1350, 960, 90, { color: IB(1) });
    return { focus: [W / 2, H / 2] };
  };
}

/* the faint print behind the CRT verses: a large golden spiral + a slow page of formulas */
function bgPrint(g, t) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  g.save(); g.translate(W / 2, H / 2); g.rotate(t * 0.02);
  g.strokeStyle = IB(0.9); g.lineWidth = 22;
  g.beginPath();
  for (let i = 0; i <= 400; i++) {
    const th = i / 400 * 5.5 * Math.PI, r = 14 * Math.pow(PHI, th * 2 / Math.PI);
    i ? g.lineTo(Math.cos(th) * r, Math.sin(th) * r) : g.moveTo(Math.cos(th) * r, Math.sin(th) * r);
  }
  g.stroke(); g.restore();
  g.fillStyle = IA(0.55);
  for (let k = 0; k < 9; k++) {
    const y = ((k * 140 - t * 22) % (H + 140) + H + 140) % (H + 140) - 70;
    g.fillRect(80, y, 260 + (k * 97 % 200), 10);
    g.fillRect(W - 420, y + 50, 300 - (k * 61 % 150), 10);
  }
}
