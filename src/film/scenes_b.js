/* ===================================================================
   Plan B scenes: the two-ink riso print. Drawn into a channel canvas
   (R = pink ink density, G = blue ink density); the riso look screens and
   misregisters them. Black background = bare paper.
   =================================================================== */
const IA = (a = 1) => `rgba(255,0,0,${a})`, IB = (a = 1) => `rgba(0,255,0,${a})`, IAB = (a = 1) => `rgba(255,255,0,${a})`;

function bBegin(g) {
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
}
/* page furniture: folio, rule, running head */
function folio(g, t, n, head) {
  g.fillStyle = IB(0.85);
  g.fillRect(110, 92, W - 220, 3);
  g.font = `700 26px ${FONT_STACKS.latin}`; g.textBaseline = 'alphabetic';
  g.textAlign = 'left'; g.fillText(head, 110, 76);
  g.textAlign = 'right'; g.fillText(String(n), W - 110, 76);
  g.fillRect(110, H - 86, W - 220, 2);
}
/* B lyric: ink-A type that stamps in with a misregistration that converges */
function bLyric(g, L, t, o = {}) {
  return drawLyric(g, L, t, Object.assign({
    size: 150, maxW: 1500, pop: 0.18, flash: 0, align: o.align,
    colorOf: () => IA(1),
    after: null,
    motion: (q, s, x, y) => ({ x, y: y + 18 * s.ex, rot: 0, sc: s.k, a: s.a }),
  }, o));
}

/* a quantum circuit: wires |0>, H gate, CNOT, measurement meters */
function circuit(g, t, t0, o = {}) {
  const CA = o.ca || IA, CB = o.cb || IB;
  g.save();
  const x0 = o.x ?? 860, x1 = o.x1 ?? 1800, ys = o.ys || [470, 640, 810];
  const rev = k => smoothstep(t0 + k * BEAT, t0 + (k + 1) * BEAT, t);
  /* wires draw across on the first two beats */
  ys.forEach((y, i) => {
    const e = rev(i * 0.5);
    g.fillStyle = CB(0.9); g.fillRect(x0, y - 2.5, (x1 - x0) * e, 5);
    if (e > 0.05) drawTex(g, 'ket0', x0 - 70, y, 62, { color: CB(1), alpha: smoothstep(0, 0.4, e) });
  });
  /* H gates on beats 3.. */
  ys.forEach((y, i) => {
    const e = rev(2 + i * 0.5); if (e <= 0) return;
    const x = x0 + 160, s = 98 * (1 + 0.25 * Math.exp(-(t - t0 - (2 + i * 0.5) * BEAT) * 10));
    g.fillStyle = CA(e); g.fillRect(x - s / 2, y - s / 2, s, s);
    g.fillStyle = '#000'; g.globalCompositeOperation = 'source-over';
    g.fillRect(x - s / 2 + 8, y - s / 2 + 8, s - 16, s - 16);
    g.globalCompositeOperation = 'lighter';
    drawTex(g, 'Hg', x, y, s * 0.5, { color: CA(1), alpha: e });
  });
  /* CNOTs linking the wires: entanglement */
  [[0, 1, 4], [1, 2, 4.5]].forEach(([a, b, k]) => {
    const e = rev(k); if (e <= 0) return;
    const x = x0 + 330 + (b - 1) * 120;
    g.fillStyle = CB(1); g.beginPath(); g.arc(x, ys[a], 13, 0, TAU); g.fill();
    g.fillRect(x - 2.5, ys[a], 5, (ys[b] - ys[a]) * e);
    if (e > 0.9) { g.strokeStyle = CB(1); g.lineWidth = 5; g.beginPath(); g.arc(x, ys[b], 26, 0, TAU); g.stroke();
      g.beginPath(); g.moveTo(x - 26, ys[b]); g.lineTo(x + 26, ys[b]); g.moveTo(x, ys[b] - 26); g.lineTo(x, ys[b] + 26); g.stroke(); }
  });
  /* measurement meters: each needle swings and settles to an outcome */
  ys.forEach((y, i) => {
    const e = rev(5 + i * 0.4); if (e <= 0) return;
    const x = x1 - 120, w = 120, h = 92;
    g.strokeStyle = CA(1); g.lineWidth = 5; g.strokeRect(x - w / 2, y - h / 2, w, h);
    g.beginPath(); g.arc(x, y + h * 0.32, w * 0.36, Math.PI, 0); g.stroke();
    const dt = Math.max(0, t - t0 - (5 + i * 0.4) * BEAT);
    const res = (o.results || [0, 1, 1])[i];
    const ang = -Math.PI / 2 + (res ? 0.62 : -0.62) * (1 - Math.exp(-dt * 6) * Math.cos(dt * 16));
    g.lineWidth = 6; g.beginPath(); g.moveTo(x, y + h * 0.32);
    g.lineTo(x + Math.cos(ang) * w * 0.42, y + h * 0.32 + Math.sin(ang) * w * 0.42); g.stroke();
    if (dt > 0.35) drawTex(g, res ? 'ket1' : 'ket0', x + 120, y, 60, { color: CA(1), alpha: smoothstep(0.35, 0.6, dt) });
  });
  g.restore();
}

/* the eye: a measurement dial opening like an eyelid (Open the eyes) */
function eyeDial(g, t, t0, cx, cy, r) {
  const op = easeOut(smoothstep(t0, t0 + 0.55, t));
  if (op <= 0) return;
  g.save();
  g.beginPath();
  g.moveTo(cx - r * 1.6, cy);
  g.quadraticCurveTo(cx, cy - r * 1.25 * op, cx + r * 1.6, cy);
  g.quadraticCurveTo(cx, cy + r * 1.25 * op, cx - r * 1.6, cy);
  g.closePath();
  g.strokeStyle = IA(1); g.lineWidth = 9; g.stroke();
  g.clip();
  g.fillStyle = IB(0.5); g.beginPath(); g.arc(cx, cy, r * 0.85, 0, TAU); g.fill();
  g.fillStyle = IB(1); g.beginPath(); g.arc(cx, cy, r * 0.42, 0, TAU); g.fill();
  /* the dial's ticks around the iris */
  g.strokeStyle = IA(0.9); g.lineWidth = 4;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU + t * 0.4;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
    g.lineTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); g.stroke();
  }
  g.restore();
}

/* ---------- B1 / B3: the circuit page (前サビ: 守られてきた ゲート / 規制は終わった) ---------- */
function bGate(spec) {
  return (g, t, io) => {
    bBegin(g);
    const t0 = spec.t0;
    /* the page slides in: tiny drift so it is held, not pinned */
    g.save();
    const dr = 6 * Math.sin((t - t0) * 0.8);
    g.translate(dr, -dr * 0.5);
    folio(g, t, spec.page, spec.head);
    circuit(g, t, t0 + 0.1, { results: spec.results });
    /* the gate line: 守られてきた / 閉ざされてきた  ゲート */
    const Lg = LINES[spec.gate];
    bLyric(g, Lg, t, { x: 470, y: 380, size: 132, maxW: 720 });
    /* 「規制」は終わった : stamp, then 規制 struck out in pink */
    const Lk = LINES[spec.kisei];
    const lay = bLyric(g, Lk, t, { x: 470, y: 760, size: 150, maxW: 760, colorOf: (q) => '「」規制'.includes(q.u.text) ? IB(1) : IA(1) });
    if (lay) {
      const k1 = lay.glyphs.find(q => q.u.text === '規'), k2 = lay.glyphs.find(q => q.u.text === '制');
      const ta = Lk.units.find(u => u.text === 'は').t;
      const e = easeOut(smoothstep(ta, ta + 0.3, t)) * (1 - smoothstep(Lk.off - 0.3, Lk.off, t));
      if (k1 && k2 && e > 0) {
        const xa = 470 + k1.x - k1.w / 2 - 10, xb = 470 + k2.x + k2.w / 2 + 10;
        g.fillStyle = IA(1); g.fillRect(xa, 760 - 9, (xb - xa) * e, 18);
      }
    }
    /* Open the eyes */
    const Lo = LINES[spec.open];
    if (t >= Lo.on - 0.05) {
      eyeDial(g, t, Lo.first, 470, 560, 120 * (1 - smoothstep(Lo.off, Lo.off + 0.4, t)));
      bLyric(g, Lo, t, { x: 470, y: 960, size: 84, maxW: 700, colorOf: () => IB(1) });
    }
    g.restore();
    return { focus: [W / 2, H / 2] };
  };
}

/* ---------- B2: 景色は / 「収束」をする — the Fibonacci ratio converging on φ ---------- */
const PHI = (1 + Math.sqrt(5)) / 2;
const FIB = [1, 1]; for (let i = 2; i < 30; i++) FIB.push(FIB[i - 1] + FIB[i - 2]);
const RATIO = FIB.slice(1).map((f, i) => f / FIB[i]);
function bConverge(spec) {
  const LE = LINES[spec.keshiki], LS = LINES[spec.shusoku];
  const PX = 780, PW = 1020, PY = 290, PH = 520;
  const yOf = r => PY + PH / 2 - clamp(r - PHI, -0.62, 0.62) * PH * 0.78;
  const xOf = n => PX + PW * (1 - Math.exp(-n / 5.2));
  return (g, t, io) => {
    bBegin(g);
    folio(g, t, spec.page, 'LIMITS · CONVERGENCE');
    const t0 = LS.first;
    /* その目に映る景色は : top line, ink B */
    bLyric(g, LE, t, { x: 110, y: 190, size: 96, maxW: 900, align: 'left', colorOf: () => IB(1) });
    /* axis + limit */
    g.fillStyle = IB(0.85); g.fillRect(PX, PY + PH + 30, PW, 4);
    const lim = smoothstep(LE.first, LE.first + 1.2, t);
    g.fillStyle = IB(0.6);
    for (let x = PX; x < PX + PW * lim; x += 26) g.fillRect(x, yOf(PHI) - 2, 14, 4);
    /* one sample per beat from the start of 景色 */
    const n = clamp(beatAt(t) - beatAt(LE.first + 0.3), 0, RATIO.length);
    g.lineWidth = 6; g.strokeStyle = IA(1);
    g.beginPath();
    for (let i = 0; i < Math.floor(n); i++) { const x = xOf(i), y = yOf(RATIO[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < Math.floor(n); i++) {
      const r = 15 + 18 * Math.exp(-(n - i) * 2.2);
      g.fillStyle = IA(1); g.beginPath(); g.arc(xOf(i), yOf(RATIO[i]), r, 0, TAU); g.fill();
    }
    g.fillStyle = IB(0.24);
    g.beginPath();
    for (let i = 0; i <= 60; i++) { const k = i / 3; g.lineTo(xOf(k), yOf(PHI) - PH * 0.42 * Math.pow(PHI, -2 * k)); }
    for (let i = 60; i >= 0; i--) { const k = i / 3; g.lineTo(xOf(k), yOf(PHI) + PH * 0.42 * Math.pow(PHI, -2 * k)); }
    g.fill();
    const cur = RATIO[Math.max(0, Math.floor(n) - 1)];
    g.font = `400 46px ${FONT_STACKS.latin}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillStyle = IB(1); g.fillText(cur.toFixed(9), PX + PW, PY - 30);
    /* 「収束」をする : 収 束 printed by both drums, misregistration converging to 0 */
    const faces = { '収': 330, '束': 330 };
    const SL = { '「': [150, 330, 150], '収': [140, 520, 330], '束': [140, 850, 330], '」': [400, 1000, 150],
                 'を': [560, 560, 140], 'す': [560, 720, 140], 'る': [560, 880, 140] };
    for (const u of LS.units) {
      const dt = t - u.t; if (dt < 0 || !SL[u.text]) continue;
      const [x, y, size] = SL[u.text];
      const f = faceOf(u.text);
      const s = size * (1 + 0.22 * Math.exp(-dt * 12));
      g.font = fontOf(f, s); g.textAlign = 'left'; g.textBaseline = 'middle';
      if (faces[u.text]) {
        const conv = Math.exp(-dt * 1.4) * 70;
        g.fillStyle = IB(1); g.fillText(u.text, x - conv, y + conv * 0.5);
        g.fillStyle = IA(1); g.fillText(u.text, x + conv, y - conv * 0.5);
      } else { g.fillStyle = IA(1); g.fillText(u.text, x, y); }
    }
    const hh = texFitHeight('fibconv', 760, 120);
    drawTex(g, 'fibconv', PX + PW / 2 + 60, 975, hh, { color: IB(1), tags: { 1: IAB(1) }, reveal: smoothstep(t0 + 0.6, t0 + 2.4, t) });
    return { focus: [W / 2, H / 2] };
  };
}
