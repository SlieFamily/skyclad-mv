/* ===================================================================
   Revision 3 — new CRT (A-style) shots for the first two minutes, plus
   A-style replacements for every former B page. One staging idea per line;
   type moves with the idea instead of sitting centred.
   =================================================================== */

/* ---------- helpers ---------- */
const lineOf = i => LINES[i];
const uAt = (L, ch) => (L.units.find(u => u.text === ch) || L.units[0]).t;
/* a lyric whose glyphs follow an arbitrary path p(i, n, s) -> {x, y, rot} */
function pathLyric(g, L, t, size, path, o = {}) {
  const lay = layoutLine(L, size, { maxW: 4000, oneRow: true });
  const n = lay.glyphs.length;
  /* glyph index in the one-row layout; drawLyric's own index is only the same when there are no spaces */
  const idx = new Map(lay.glyphs.map((q, k) => [q.u, k]));
  return aLyric(g, L, t, Object.assign({ x: 0, y: 0, size, maxW: 4000, oneRow: true,
    motion: (q, s) => { const p = path(idx.get(q.u), n, s, q); return { x: p.x, y: p.y, rot: p.rot || 0, sc: s.k * (p.sc || 1), a: s.a * (p.a ?? 1) }; } }, o));
}

/* ---------- V1: 過去は離れて行き / 未来は近づくの? (26.0–31.4) ----------
   A time axis runs across the tube. 過去 slides off to the left and shrinks
   into the vanishing point; 未来 rushes in from the right. A cursor marks NOW
   in the middle and never moves. */
function shotPastFuture(g, t) {
  const L0 = lineOf(0), L1 = lineOf(1);
  const y0 = 560;
  /* the axis with tick marks scrolling left: time flowing past the observer */
  g.save(); g.strokeStyle = rgba(CC.phos, 0.8); g.lineWidth = 2;
  g.beginPath(); g.moveTo(80, y0); g.lineTo(W - 80, y0); g.stroke();
  const sp = 260, off = ((t - 24.6) * 160) % sp;
  for (let x = W - 80 - off; x > 80; x -= sp / 4) {
    const big = Math.abs(((W - 80 - off - x) / (sp / 4)) % 4) < 0.01;
    g.beginPath(); g.moveTo(x, y0 - (big ? 22 : 10)); g.lineTo(x, y0 + (big ? 22 : 10)); g.stroke();
  }
  /* NOW cursor */
  g.strokeStyle = CC.red; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2, y0 - 140); g.lineTo(W / 2, y0 + 140); g.stroke();
  g.font = `700 26px ${FONT_STACKS.mono}`; g.fillStyle = CC.red; g.textAlign = 'center'; g.fillText('NOW', W / 2, y0 + 176);
  g.font = `700 30px ${FONT_STACKS.mono}`; g.fillStyle = rgba(CC.cyan, 0.85);
  g.textAlign = 'left'; g.fillText('← PAST', 90, y0 + 60); g.textAlign = 'right'; g.fillText('FUTURE →', W - 90, y0 + 60);
  g.restore();
  /* 過去は離れて行き : glyphs drift left and recede after they land */
  pathLyric(g, L0, t, 170, (i, n, s) => {
    const age = Math.max(0, s.dt);
    const x0 = W / 2 - 80 - (n - 1 - i) * 150;
    const k = 1 / (1 + age * 0.35);
    return { x: x0 - age * 55, y: y0 - 150, sc: lerp(0.5, 1, k), a: lerp(0.35, 1, k) };
  }, { colors: { '過': CC.cyan, '去': CC.cyan } });
  /* 未来は近づくの? : glyphs fly in from the right, growing, and stop at NOW */
  pathLyric(g, L1, t, 170, (i, n, s) => {
    const e = easeOut(clamp(s.dt / 0.35, 0, 1));
    const xT = W / 2 + 70 + i * 140;
    return { x: lerp(W + 200, xT, e), y: y0 + 120 - 260 * (1 - e) * 0, sc: lerp(0.3, 1, e) };
  }, { colors: { '未': CC.phos, '来': CC.phos } });
  drawTex(g, 'entropy', 1600, 200, 78, { color: rgba(CC.cyan, 1), alpha: smoothstep(26.5, 27, t), reveal: smoothstep(26.5, 27.6, t) });
}

/* ---------- V2: 観測者はいつか 矛盾に気付く (31.4–37.5) ----------
   The scope's crosshair hunts across the tube, locks onto the observer's own
   reflection; 矛盾 splits the screen into two contradictory read-outs. */
function shotContradiction(g, t) {
  const L = lineOf(2);
  const tm = uAt(L, '矛');
  /* hunting crosshair, locks at 観測者 */
  const lockE = easeInOut(smoothstep(L.first - 0.4, L.first + 1.0, t));
  const hx = lerp(W / 2 + 520 * Math.sin(t * 2.3), 560, lockE), hy = lerp(470 + 200 * Math.cos(t * 1.7), 360, lockE);
  g.save(); g.strokeStyle = rgba(CC.amber, 0.9); g.lineWidth = 2;
  g.beginPath(); g.arc(hx, hy, 90, 0, TAU); g.moveTo(hx - 140, hy); g.lineTo(hx + 140, hy); g.moveTo(hx, hy - 140); g.lineTo(hx, hy + 140); g.stroke();
  g.font = `700 24px ${FONT_STACKS.mono}`; g.fillStyle = CC.amber; g.textAlign = 'left';
  g.fillText(lockE > 0.98 ? 'TARGET : SELF' : 'SEARCHING …', hx + 104, hy - 100);
  g.restore();
  /* split: after 矛, the right half shows the inverted reading */
  const sp = easeOut(smoothstep(tm, tm + 0.3, t));
  const rows = L.jp.split(' ');
  g.save();
  aLyric(g, L, t, { x: 560 + 60, y: 360, size: 150, maxW: 900, oneRow: false,
    colors: { '矛': CC.red, '盾': CC.red },
    motion: (q, s, x, y) => {
      const row2 = q.row === 1;
      return { x: row2 ? x + 760 : x, y: row2 ? y + 340 : y, rot: 0, sc: s.k, a: s.a };
    } });
  if (sp > 0) {
    g.strokeStyle = rgba(CC.red, 0.9 * sp); g.lineWidth = 3; g.setLineDash([16, 12]);
    g.beginPath(); g.moveTo(W / 2, 120 * sp); g.lineTo(W / 2, H - 120 * sp); g.stroke(); g.setLineDash([]);
    g.font = `700 34px ${FONT_STACKS.mono}`; g.textAlign = 'center';
    g.fillStyle = rgba(CC.phos, sp); g.fillText('A = TRUE', W / 4, 960);
    g.fillStyle = rgba(CC.red, sp); g.fillText('A = FALSE', W * 3 / 4, 960);
    drawTex(g, 'noncon', W * 3 / 4, 220, 70, { color: rgba(CC.red, 1), alpha: sp, reveal: sp });
  }
  g.restore();
}

/* ---------- V3: 神の創り出した世界は (37.5–40.9) ----------
   The camera pulls back from a single dot to a whole wireframe globe; 神 is
   huge, written in the sky above it. */
function shotGodWorld(g, t) {
  const L = lineOf(3);
  const e = easeOut(smoothstep(L.first - 0.3, L.first + 2.2, t));
  const R = lerp(20, 290, e);
  drawGlobe(g, t, W / 2, 570, R, 0.9);
  pathLyric(g, L, t, 160, (i, n, s, q) => {
    const big = q.u.text === '神';
    const ang = -Math.PI * 0.85 + (i / (n - 1)) * Math.PI * 0.7;
    const rr = R + 170;
    /* 神 stands alone above the globe; the rest of the line runs straight beneath it */
    return big ? { x: W / 2, y: 170, sc: 1.4 } : { x: W / 2 + (i - 1 - (n - 2) / 2) * 150, y: 990, rot: 0, sc: 0.85 };
  }, { colors: { '神': CC.white, '世': CC.cyan, '界': CC.cyan } });
  drawTex(g, 'euler', 1620, 300, 70, { color: rgba(CC.cyan, 1), alpha: e, reveal: e });
}

/* ---------- V4: 完全なるもので 絶対の均衡 (40.9–48.3) ----------
   A beam balance. The first phrase loads the left pan, 絶対の均衡 the right;
   the beam swings and settles dead level on 衡. */
function shotBalance(g, t) {
  const L = lineOf(4);
  const tz = uAt(L, '絶'), tk = uAt(L, '衡');
  const cx = W / 2, cy = 600;
  const sw = t < tz ? 0.22 * smoothstep(L.first, tz, t) : 0.22 * Math.exp(-(t - tz) * 1.2) * Math.cos((t - tz) * 5.5);
  const ang = t > tk + 0.8 ? sw * Math.exp(-(t - tk - 0.8) * 3) : sw;
  g.save(); g.strokeStyle = CC.amber; g.lineWidth = 5;
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy + 330); g.moveTo(cx - 140, cy + 330); g.lineTo(cx + 140, cy + 330); g.stroke();
  g.translate(cx, cy); g.rotate(ang);
  g.beginPath(); g.moveTo(-620, 0); g.lineTo(620, 0); g.stroke();
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 620, 0); g.lineTo(s * 620, 120); g.stroke(); g.strokeRect(s * 620 - 260, 120, 520, 8); }
  g.restore();
  const panY = s => cy + 80 + Math.sin(ang) * 620 * s;
  aLyric(g, L, t, { x: 0, y: 0, size: 112, maxW: 4000, oneRow: false,
    motion: (q, s, x, y) => {
      const side = q.row === 0 ? -1 : 1;
      return { x: cx + side * 620 + (x - 0) * 0.92, y: panY(side) - 10, rot: ang, sc: s.k, a: s.a };
    }, colors: { '絶': CC.white, '対': CC.white, '均': CC.amber, '衡': CC.amber } });
  const lv = smoothstep(tk + 0.8, tk + 1.6, t);
  if (lv > 0) {
    g.save(); g.globalAlpha = lv; g.font = `700 30px ${FONT_STACKS.mono}`; g.fillStyle = CC.phos; g.textAlign = 'center';
    g.fillText('Σ F = 0   ·   Σ τ = 0', cx, 200); g.restore();
  }
  drawTex(g, 'efe', cx, 300, 64, { color: rgba(CC.cyan, 1), alpha: smoothstep(tk, tk + 0.5, t), reveal: smoothstep(tk, tk + 1, t) });
}

/* ---------- V5: それは折り重なる偶然 (48.3–52.6) ----------
   Galton board: balls fall through pegs on the 16ths; each glyph IS a ball,
   bouncing down and landing in the bins in order. */
function shotGalton(g, t) {
  const L = lineOf(5);
  const top = 150, rows = 9, gap = 70, cx = W / 2;
  g.save(); g.fillStyle = rgba(CC.phos, 0.55);
  for (let r = 0; r < rows; r++) for (let k = 0; k <= r; k++) {
    g.beginPath(); g.arc(cx + (k - r / 2) * gap, top + r * gap * 0.9, 5, 0, TAU); g.fill();
  }
  /* small balls, seeded path, one every 16th */
  const n0 = Math.floor((t - L.first + 0.6) * 22);
  const bins = new Array(rows + 1).fill(0);
  for (let b = 0; b < Math.max(0, n0); b++) {
    let k = 0; for (let r = 0; r < rows; r++) k += hash1(b * 31 + r * 977) > 0.5 ? 1 : 0;
    const age = (t - L.first + 0.6) - b / 22;
    if (age > 1.2) { bins[k]++; continue; }
    const rr = clamp(age / 1.2 * rows, 0, rows), ri = Math.floor(rr);
    let kk = 0; for (let r = 0; r < ri; r++) kk += hash1(b * 31 + r * 977) > 0.5 ? 1 : 0;
    g.fillStyle = CC.amber; g.beginPath(); g.arc(cx + (kk - ri / 2) * gap, top + rr * gap * 0.9, 7, 0, TAU); g.fill();
  }
  g.fillStyle = rgba(CC.phos, 0.8);
  bins.forEach((c, k) => g.fillRect(cx + (k - rows / 2) * gap - 24, 1010 - Math.min(c * 6, 90), 48, Math.min(c * 6, 90)));
  g.restore();
  /* the glyphs fall in a zigzag into place across the bins */
  pathLyric(g, L, t, 140, (i, n, s) => {
    const e = easeOut(clamp(s.dt / 0.5, 0, 1));
    const xT = cx + (i - (n - 1) / 2) * 150, yT = 820;
    const zig = Math.sin(e * Math.PI * 4) * 60 * (1 - e);
    return { x: lerp(cx, xT, e) + zig, y: lerp(top - 60, yT, e) };
  }, { colors: { '偶': CC.amber, '然': CC.amber } });
  drawTex(g, 'uncert', 300, 230, 70, { color: rgba(CC.cyan, 1), alpha: smoothstep(L.first, L.first + 0.4, t), reveal: smoothstep(L.first, L.first + 1, t) });
}

/* ---------- V6: 宇宙規模の奇跡 (52.6–54.8) ----------
   Rapid zoom out: the glyphs become a spiral galaxy's arms. */
function shotGalaxy(g, t) {
  const L = lineOf(6);
  const z = easeIn(smoothstep(L.first - 0.2, L.end + 0.4, t));
  const sc = lerp(2.2, 0.7, z);
  g.save(); g.translate(W / 2, 540); g.scale(sc, sc); g.rotate(t * 0.4);
  g.fillStyle = CC.pale;
  for (let i = 0; i < 1600; i++) {
    const arm = i % 2, r = Math.pow(hash1(i * 3 + 1), 0.6) * 520;
    const th = arm * Math.PI + r * 0.011 + (hash1(i * 3 + 2) - 0.5) * 0.6;
    g.globalAlpha = 0.35 + 0.5 * hash1(i * 7);
    g.fillRect(Math.cos(th) * r, Math.sin(th) * r * 0.5, 2.4, 2.4);
  }
  g.restore();
  pathLyric(g, L, t, 150, (i, n, s) => {
    /* the line lands readable left-to-right, then the arms of the galaxy pull it into orbit */
    const xT = W / 2 + (i - (n - 1) / 2) * 175, k = smoothstep(L.last + 0.25, L.end + 0.9, t);
    const th = Math.atan2(0, xT - W / 2) + k * 1.2, r = Math.abs(xT - W / 2) + 40;
    return { x: lerp(xT, W / 2 + Math.cos(th) * r, k), y: lerp(540, 540 + Math.sin(th) * r * 0.5, k), sc: 1 - 0.3 * k };
  }, { colors: { '奇': CC.amber, '跡': CC.amber, '宇': CC.cyan, '宙': CC.cyan } });
}

/* A verse-1 scene that sequences the six shots above, each cut on its line */
function aVerse1v3() {
  const shots = [
    [24.6, shotPastFuture], [lineOf(2).first - 0.5, shotContradiction], [lineOf(3).first - 0.4, shotGodWorld],
    [lineOf(4).first - 0.3, shotBalance], [lineOf(5).first - 0.4, shotGalton], [lineOf(6).first - 0.3, shotGalaxy],
  ];
  return aScene((g, t) => {
    let k = 0; while (k + 1 < shots.length && t >= shots[k + 1][0]) k++;
    const [t0, f] = shots[k];
    /* every internal cut: a retrace sweep and a one-frame raster roll */
    retrace(g, t, t0, 0.42);
    f(g, t);
    return [W / 2, H / 2];
  }, { hud: t => ({ right: ['VERSE  01', 'OBS  0001'] }) });
}

/* ---------- former-B pages, rebuilt in the CRT language ---------- */
/* the quantum circuit on the oscilloscope: same gates, phosphor colours */
const CR_A = a => rgba(CC.amber, a), CR_B = a => rgba(CC.phos, a);
function aGate(spec) {
  return aScene((g, t) => {
    const t0 = spec.t0;
    circuit(g, t, t0 + 0.1, { results: spec.results, ca: CR_A, cb: CR_B });
    /* 守られてきた / 閉ざされてきた ゲート — the gate line types across the top */
    const Lg = LINES[spec.gate];
    aLyric(g, Lg, t, { x: 470, y: 330, size: 120, maxW: 720, colors: { 'ゲ': CC.amber, 'ー': CC.amber, 'ト': CC.amber } });
    /* 「規制」は終わった — 規制 struck through in red */
    const Lk = LINES[spec.kisei];
    const lay = aLyric(g, Lk, t, { x: 470, y: 640, size: 130, maxW: 760, colors: { '規': CC.red, '制': CC.red },
      offAt: Math.min(Lk.off, LINES[spec.open].first - 0.02), exitDur: 0.12 });
    if (lay) {
      const k1 = lay.glyphs.find(q => q.u.text === '規'), k2 = lay.glyphs.find(q => q.u.text === '制');
      const ta = uAt(Lk, 'は');
      const e = easeOut(smoothstep(ta, ta + 0.3, t)) * (1 - smoothstep(Lk.off - 0.3, Lk.off, t));
      if (k1 && k2 && e > 0) { g.fillStyle = CC.red; const xa = 470 + k1.x - k1.w / 2 - 10, xb = 470 + k2.x + k2.w / 2 + 10; g.fillRect(xa, 640 - 6, (xb - xa) * e, 12); }
      /* ACCESS GRANTED stamp after 終わった */
      const tg = uAt(Lk, 'た') + 0.05, a = smoothstep(tg, tg + 0.08, t) * (1 - smoothstep(LINES[spec.open].first - 0.1, LINES[spec.open].first, t));
      if (a > 0) { g.save(); g.globalAlpha = a; g.strokeStyle = CC.phos; g.lineWidth = 4; g.strokeRect(150, 760, 640, 90);
        g.font = `700 52px ${FONT_STACKS.mono}`; g.fillStyle = CC.phos; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ACCESS  GRANTED', 470, 806); g.restore(); }
    }
    const Lo = LINES[spec.open];
    if (t >= Lo.on - 0.05) {
      /* the eye opens over the whole tube; the circuit dims under it */
      const ea = 1 - smoothstep(Lo.off, Lo.off + 0.4, t);
      g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(3,6,10,${0.8 * ea * smoothstep(Lo.first - 0.1, Lo.first + 0.2, t)})`;
      g.fillRect(0, 0, W, H); g.restore();
      vectorEye(g, t, Lo.first, W / 2, 470, 240 * ea, CC.phos);
      aLyric(g, Lo, t, { x: W / 2, y: 880, size: 120, maxW: 1200, colorOf: () => CC.amber });
    }
    drawTex(g, 'hadamard', 1330, 200, 92, { color: rgba(CC.cyan, 1), alpha: smoothstep(t0, t0 + 0.6, t), reveal: smoothstep(t0, t0 + 1.4, t) });
    return [W / 2, H / 2];
  }, { hud: t => ({ right: ['QUANTUM GATE', spec.head || ''] }) });
}

/* 景色は / 「収束」をする — the Fibonacci ratio converging on φ, drawn on the scope */
function aConverge(spec) {
  const LE = LINES[spec.keshiki], LS = LINES[spec.shusoku];
  const PX = 780, PW = 1020, PY = 290, PH = 520;
  const yOf = r => PY + PH / 2 - clamp(r - PHI, -0.62, 0.62) * PH * 0.78;
  const xOf = n => PX + PW * (1 - Math.exp(-n / 5.2));
  return aScene((g, t) => {
    aLyric(g, LE, t, { x: 110, y: 170, size: 96, maxW: 900, align: 'left' });
    g.fillStyle = rgba(CC.phos, 0.6); g.fillRect(PX, PY + PH + 30, PW, 2);
    const lim = smoothstep(LE.first, LE.first + 1.2, t);
    g.fillStyle = rgba(CC.cyan, 0.8);
    for (let x = PX; x < PX + PW * lim; x += 26) g.fillRect(x, yOf(PHI) - 1.5, 14, 3);
    const n = clamp(beatAt(t) - beatAt(LE.first + 0.3), 0, RATIO.length);
    g.lineWidth = 4; g.strokeStyle = CC.amber; g.beginPath();
    for (let i = 0; i < Math.floor(n); i++) { const x = xOf(i), y = yOf(RATIO[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < Math.floor(n); i++) {
      const r = 8 + 14 * Math.exp(-(n - i) * 2.2);
      g.fillStyle = CC.amber; g.beginPath(); g.arc(xOf(i), yOf(RATIO[i]), r, 0, TAU); g.fill();
    }
    g.strokeStyle = rgba(CC.phos, 0.45); g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 60; i++) { const k = i / 3; g.lineTo(xOf(k), yOf(PHI) - PH * 0.42 * Math.pow(PHI, -2 * k)); }
    g.stroke(); g.beginPath();
    for (let i = 0; i <= 60; i++) { const k = i / 3; g.lineTo(xOf(k), yOf(PHI) + PH * 0.42 * Math.pow(PHI, -2 * k)); }
    g.stroke();
    const cur = RATIO[Math.max(0, Math.floor(n) - 1)];
    g.font = `700 46px ${FONT_STACKS.latin}`; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillStyle = CC.amber; g.fillText(cur.toFixed(9), PX + PW, PY - 30);
    /* 「収束」をする, vertical on the left; 収 and 束 each start as two offset copies that converge */
    const SL = { '「': [150, 330, 150], '収': [140, 520, 330], '束': [140, 850, 330], '」': [400, 1000, 150],
                 'を': [560, 560, 140], 'す': [560, 720, 140], 'る': [560, 880, 140] };
    for (const u of LS.units) {
      const dt = t - u.t; if (dt < 0 || !SL[u.text]) continue;
      const [x, y, size] = SL[u.text];
      const f = faceOf(u.text), s = size * (1 + 0.22 * Math.exp(-dt * 12));
      g.font = fontOf(f, s); g.textAlign = 'left'; g.textBaseline = 'middle';
      if (u.text === '収' || u.text === '束') {
        const conv = Math.exp(-dt * 1.4) * 70;
        g.globalAlpha = 0.6; g.fillStyle = CC.cyan; g.fillText(u.text, x - conv, y + conv * 0.5);
        g.fillStyle = CC.amber; g.fillText(u.text, x + conv, y - conv * 0.5); g.globalAlpha = 1;
        g.fillStyle = CC.white; g.globalAlpha = 1 - Math.exp(-dt * 1.4); g.fillText(u.text, x, y); g.globalAlpha = 1;
      } else { g.fillStyle = CC.phos; g.fillText(u.text, x, y); }
    }
    drawTex(g, 'fibconv', PX + PW / 2 + 60, 975, texFitHeight('fibconv', 760, 120),
      { color: rgba(CC.cyan, 1), tags: { 1: rgba(CC.amber, 1) }, reveal: smoothstep(LS.first + 0.6, LS.first + 2.4, t) });
    return [W / 2, H / 2];
  }, { hud: t => ({ right: ['LIMIT', 'n → ∞'] }) });
}

/* ---------- chorus 1b, restaged (71.5–85) ----------
   Open the eyes: the eye opens and its iris IS the scope dot; then
   並行する無数の線: the trace multiplies beat by beat, each copy carrying the
   line; 選択は冒涜へ: all but one trace are cut; 存在: the remaining trace
   flickers between two values. */
function aChorus1bv3() {
  const Lo = lineOf(13), L1 = lineOf(14), L2 = lineOf(15);
  const tSel = uAt(L1, '選');
  return aScene((g, t) => {
    if (t < L1.first + 0.2) {
      const e = 1 - smoothstep(L1.first - 0.3, L1.first + 0.2, t);
      g.save(); g.globalAlpha = e; vectorEye(g, t, Lo.first, W / 2, 470, 240, CC.phos); g.restore();
      aLyric(g, Lo, t, { x: W / 2, y: 860, size: 120, maxW: 1200 });
    }
    /* traces multiply, one per beat, from the line start */
    const nB = clamp(Math.floor(beatAt(t) - beatAt(L1.first)) + 1, 0, 16);
    const cut = smoothstep(tSel, tSel + 0.5, t);
    for (let i = 0; i < nB; i++) {
      const off = (i - (nB - 1) / 2) * 52;
      const chosen = i === Math.floor((nB - 1) / 2);
      const a = chosen ? 1 : 1 - cut;
      if (a <= 0.01) continue;
      g.save(); g.globalAlpha = a; g.strokeStyle = chosen ? CC.amber : rgba(CC.phos, 0.5); g.lineWidth = chosen ? 3 : 1.6;
      g.beginPath();
      for (let x = 0; x <= W; x += 10) { const y = 600 + off * (1 - (chosen ? 0 : 0)) + Math.sin(x * 0.004 + i * 1.9 + t * 0.9) * 26; x ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.restore();
    }
    /* 並行する無数の線 — the glyphs scatter across the parallel traces */
    /* 並行する無数の線 — two rows riding the traces; 選択は冒涜へ settles on the chosen one */
    aLyric(g, L1, t, { x: W / 2, y: 0, size: 136, maxW: 1700, oneRow: false,
      colors: { '冒': CC.red, '涜': CC.red, '選': CC.amber, '択': CC.amber },
      motion: (q, s, x, y, i) => {
        const r0 = q.row === 0;
        const wob = r0 ? Math.sin(i * 1.3 + t * 2) * 14 : 0;
        return { x, y: (r0 ? 390 : 800) + wob, rot: 0, sc: s.k, a: s.a };
      } });
    /* 僕らの「存在」さえ疑う — big, on the surviving trace, flickering */
    if (t > L2.on) {
      const bit = hash1(Math.floor(t * 12) * 17) < 0.5;
      aLyric(g, L2, t, { x: W / 2, y: 330, size: 170, maxW: 1640, oneRow: true,
        colors: { '存': bit ? CC.white : CC.red, '在': bit ? CC.white : CC.red },
        motion: (q, s, x, y) => ({ x: x + (('存在'.includes(q.u.text)) ? (bit ? 6 : -6) : 0), y, rot: 0, sc: s.k, a: s.a }) });
      g.save(); g.font = `700 44px ${FONT_STACKS.mono}`; g.textAlign = 'center'; g.fillStyle = bit ? CC.amber : CC.red;
      g.globalAlpha = smoothstep(L2.first, L2.first + 0.3, t);
      g.fillText(`EXISTS(OBSERVER) = ${bit ? 1 : 0}`, W / 2, 900); g.restore();
    }
    drawTex(g, 'everett', W / 2, 160, 70, { color: rgba(CC.cyan, 1), alpha: smoothstep(L1.first, L1.first + 0.4, t) * (1 - smoothstep(L2.first - 0.3, L2.first, t)), reveal: smoothstep(L1.first, L1.first + 1, t) });
    return [W / 2, 600];
  }, { focus: () => [W / 2, 600], hud: t => ({ right: ['BRANCHES  ' + clamp(Math.floor(beatAt(t) - beatAt(lineOf(14).first)) + 1, 1, 16), 'OBS  0001'] }) });
}

/* ---------- verse 2b, restaged (123.4–141) ----------
   英知 = a ring of formulas orbiting a head-shaped wireframe; 果て = the
   black-hole schematic, the type falls into it; 愚か故の偶然 = dice of light;
   招かれざる奇跡 = a star that flares and is clipped by an ERROR frame. */
function aVerse2bv3() {
  const L0 = lineOf(20), L1 = lineOf(21), L2 = lineOf(22), L3 = lineOf(23);
  const FORM = ['euler', 'schrod', 'efe', 'uncert', 'interval', 'kepler'];
  return aScene((g, t) => {
    if (t < L1.first - 0.3) {
      /* knowledge granted: formulas orbit the globe */
      drawGlobe(g, t, W / 2, 560, 220, 0.7);
      FORM.forEach((f, i) => {
        const th = i / FORM.length * TAU + t * 0.5, a = smoothstep(L0.first + i * 0.25, L0.first + i * 0.25 + 0.3, t);
        drawTex(g, f, W / 2 + Math.cos(th) * 620, 560 + Math.sin(th) * 280, 48, { color: rgba(CC.cyan, 1), alpha: a * (0.5 + 0.5 * Math.sin(th)) });
      });
      aLyric(g, L0, t, { x: W / 2, y: 140, size: 132, maxW: 1640, oneRow: true, colors: { '神': CC.white, '英': CC.amber, '知': CC.amber } });
    } else if (t < L2.first - 0.3) {
      horizon(g, t, L1);
      /* the type spirals toward the horizon after it lands */
      /* the line sits under the horizon; once the whole line is sung it is pulled in */
      const pull = smoothstep(L1.last + 0.5, L1.off + 0.3, t);
      pathLyric(g, L1, t, 110, (i, n, s) => {
        const xT = W / 2 + (i - (n - 1) / 2) * 112, yT = 920;
        const k = easeIn(pull), r = Math.hypot(xT - W / 2, yT - 560), th = Math.atan2(yT - 560, xT - W / 2) + k * 1.6;
        return { x: lerp(xT, W / 2 + Math.cos(th) * r * (1 - k * 0.85), k), y: lerp(yT, 560 + Math.sin(th) * r * (1 - k * 0.85), k), sc: 1 - k * 0.6 };
      }, { colors: { '果': CC.amber, 'て': CC.amber, '絶': CC.white, '対': CC.white } });
      drawTex(g, 'schw', 1600, 190, 80, { color: rgba(CC.amber, 1), reveal: smoothstep(L1.first, L1.first + 1, t) });
    } else if (t < L3.first - 0.3) {
      /* dice of light: random bits that keep rerolling */
      for (let i = 0; i < 6; i++) {
        const v = 1 + Math.floor(hash1(Math.floor(t * 8) * 13 + i * 7) * 6), x = 360 + i * 240, y = 330;
        g.strokeStyle = CC.phos; g.lineWidth = 3; g.strokeRect(x - 70, y - 70, 140, 140);
        g.font = `700 90px ${FONT_STACKS.latin}`; g.fillStyle = CC.amber; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(v), x, y + 4);
      }
      aLyric(g, L2, t, { x: W / 2, y: 720, size: 160, maxW: 1640, oneRow: true, colors: { '偶': CC.amber, '然': CC.amber, '愚': CC.red } });
      drawTex(g, 'uncert', W / 2, 960, 70, { color: rgba(CC.cyan, 1), reveal: smoothstep(L2.first, L2.first + 1, t) });
    } else {
      /* uninvited miracle: a flare clipped by an error frame */
      const f = smoothstep(L3.first, L3.first + 0.4, t), sz = 260 + 80 * Math.sin(t * 9);
      phosDot(g, W / 2, 470, 22 * f + 2, f, '#ffffff');
      g.strokeStyle = rgba(CC.red, f); g.lineWidth = 4; g.strokeRect(W / 2 - sz, 470 - sz * 0.6, sz * 2, sz * 1.2);
      g.font = `700 34px ${FONT_STACKS.mono}`; g.fillStyle = rgba(CC.red, f); g.textAlign = 'left';
      g.fillText('UNEXPECTED EVENT', W / 2 - sz, 470 - sz * 0.6 - 18);
      aLyric(g, L3, t, { x: W / 2, y: 900, size: 170, maxW: 1640, oneRow: true, colors: { '奇': CC.white, '跡': CC.white, '招': CC.red } });
    }
    return [W / 2, H / 2];
  }, { hud: t => ({ right: ['VERSE  02', 'HORIZON'] }) });
}
