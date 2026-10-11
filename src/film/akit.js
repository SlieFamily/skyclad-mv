/* ===================================================================
   Plan A kit: the observer's CRT. Tube background, instrument HUD,
   phosphor lyric style. Colour = voice:
     phos  観測者 (the observer)    amber  機械 (machine read-outs, numbers)
     cyan  理論 (theory)            red    矛盾 (contradiction)
   =================================================================== */
const CC = { black: '#03060a', phos: '#5cf2b0', amber: '#ffb347', cyan: '#7fd8ff', red: '#ff5a52',
             dim: '#0b1a16', pale: '#d8fff0', white: '#f2fff9' };
const A_FACE_COL = { gothic: CC.phos, mincho: CC.pale, ud: CC.cyan, msgoth: CC.amber, slab: CC.amber,
                     meiryo: CC.phos, latin: CC.amber, mono: CC.amber };

function tube(g, t, o = {}) {
  g.fillStyle = CC.black; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W * 0.5, H * 0.54, 0, W * 0.5, H * 0.54, W * 0.66);
  rg.addColorStop(0, rgba(o.tint || CC.dim, 0.95)); rg.addColorStop(0.5, rgba('#061310', 0.8)); rg.addColorStop(1, rgba(CC.black, 1));
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const k = beatKick(t, 1, 7);
  const step = 68, slide = beatPhase(t) * step * (o.drift ?? 1);
  g.lineWidth = 1;
  g.strokeStyle = rgba(CC.phos, 0.045 + 0.03 * k * (o.kick ?? 1));
  g.beginPath();
  for (let x = -step + slide; x < W + step; x += step) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 540 % step - step; y < H + step; y += step) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  g.strokeStyle = rgba(CC.phos, 0.10);
  g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5); g.stroke();
  const nT = o.traces ?? 3;
  const amp = (o.amp ?? 1) * (0.55 + 0.9 * audSm(t, 1, 0.1));
  for (let k2 = 0; k2 < nT; k2++) {
    g.beginPath();
    const ph = t * 0.9 + k2 * 1.7, cv = o.conv || 0;
    for (let x = 0; x <= W; x += 8) {
      const y = H * 0.5 + (1 - cv) * amp * (Math.sin(x * 0.0042 + ph) * 40 * (1 + k2 * 0.3) + Math.sin(x * 0.0115 - ph * 1.6 + k2) * 13);
      x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.strokeStyle = rgba(CC.phos, (0.10 - k2 * 0.02) * (o.traceA ?? 1)); g.lineWidth = 1.5; g.stroke();
  }
}

/* the divergence meter never settles until the very end (o.div overrides) */
function divValue(t) { return 1.048596 + 1.4e-6 * Math.sin(t * 0.63) + 2.2e-6 * vnoise(t * 2.3, 4.1); }
function hud(g, t, o = {}) {
  const a = o.alpha ?? 1;
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.font = `500 21px ${FONT_STACKS.mono}`; g.fillStyle = rgba(CC.amber, 0.5);
  g.fillText(o.label || 'DIVERGENCE', 68, 62);
  g.font = `700 52px ${FONT_STACKS.latin}`; g.fillStyle = rgba(CC.amber, 0.95);
  g.fillText(o.divText || divValue(t).toFixed(6), 68, 112);
  /* beat ticks down the right edge */
  const bn = Math.floor(beatAt(t));
  for (let i = 0; i < 10; i++) {
    const n = bn - i, isBar = (((n % 4) + 4) % 4) === 0;
    g.fillStyle = rgba(isBar ? CC.amber : CC.phos, (isBar ? 0.55 : 0.26) * (1 - i / 10));
    g.fillRect(W - 68 - (isBar ? 40 : 22), H - 70 - i * 26, isBar ? 40 : 22, 3);
  }
  g.font = `500 20px ${FONT_STACKS.mono}`; g.fillStyle = rgba(CC.phos, 0.34);
  const tc = o.tc ?? t;
  g.fillText(`T ${tc.toFixed(2).padStart(6, '0')}s   BAR ${String(Math.max(0, Math.floor(beatAt(tc) / 4))).padStart(3, '0')}`, 68, H - 58);
  if (o.right) {
    g.textAlign = 'right'; g.fillStyle = rgba(CC.phos, 0.42);
    o.right.forEach((s, i) => g.fillText(s, W - 68, 64 + i * 28));
  }
  g.restore();
}

/* phosphor lyric: colour by face, a glow halo, a hot strike, a settle upward */
function aLyric(g, L, t, o = {}) {
  return drawLyric(g, L, t, Object.assign({
    x: W / 2, y: 520, size: 180, maxW: 1600, glow: 0.05, flash: 0.35, pop: 0.3,
    colorOf: (q) => (o.colors && o.colors[q.u.text]) || A_FACE_COL[q.f] || CC.phos,
    motion: (q, s, x, y, i) => ({ x, y: y - 9 * (1 - Math.exp(-Math.max(s.dt, 0) * 1.5)) - 30 * s.ex, rot: 0, sc: s.k, a: s.a }),
  }, o));
}

/* the retrace sweep: one bright bar falls down the tube when a line lands */
function retrace(g, t, t0, len = 0.48) {
  const dt = t - t0;
  if (dt < 0 || dt > len) return;
  const e = easeOut(dt / len), y = lerp(120, 1010, e), a = 1 - dt / len;
  const lg = g.createLinearGradient(0, y - 60, 0, y + 60);
  lg.addColorStop(0, rgba(CC.phos, 0)); lg.addColorStop(0.5, rgba(CC.phos, 0.2 * a)); lg.addColorStop(1, rgba(CC.phos, 0));
  g.fillStyle = lg; g.fillRect(0, y - 60, W, 120);
  g.fillStyle = rgba('#eafff6', 0.42 * a); g.fillRect(70, y - 1.5, W - 140, 3);
}

/* a raster roll on the downbeat: copies two bands sideways for a couple of frames */
function rasterJolt(g, t, amt = 1) {
  const r = t - barTime(Math.floor(beatAt(t) / 4));
  if (r > 0.06 || amt <= 0) return;
  const k = (1 - r / 0.06) * amt, c = g.canvas;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 0.35 * k; g.drawImage(c, 0, 0, VW, 22 * S, 26 * k * S, 0, VW, 22 * S);
  g.globalAlpha = 0.25 * k; g.drawImage(c, 0, VH - 40 * S, VW, 40 * S, -19 * k * S, VH - 40 * S, VW, 40 * S);
  g.restore();
}

/* the dot every dive goes into */
function phosDot(g, x, y, r, a = 1, col = CC.white) {
  const rg = g.createRadialGradient(x, y, 0, x, y, r * 6);
  rg.addColorStop(0, rgba(col, a)); rg.addColorStop(0.18, rgba(CC.phos, 0.6 * a)); rg.addColorStop(1, rgba(CC.phos, 0));
  g.fillStyle = rg; g.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
}

/* corner brackets: a calibration frame around a box */
function brackets(g, cx, cy, w, h, col, a = 1, k = 0.24, lw = 3) {
  g.save(); g.globalAlpha *= a; g.strokeStyle = col; g.lineWidth = lw;
  const kk = Math.min(w, h) * k;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x0 = cx + sx * w / 2, y0 = cy + sy * h / 2;
    g.beginPath(); g.moveTo(x0 - sx * kk, y0); g.lineTo(x0, y0); g.lineTo(x0, y0 - sy * kk); g.stroke();
  }
  g.restore();
}

/* the A-side transition wrapper: exit = dive (zoom into focus), enter = surface (grow out of a point) */
function aCamera(g, io, focus, fn) {
  g.save();
  let fs = focus;
  if (io.exit != null && io.kind === 'dive') {
    const e = easeIn(io.exit), k = Math.exp(e * 4.2);
    const cx = lerp(focus[0], W / 2, smooth(io.exit)), cy = lerp(focus[1], H / 2, smooth(io.exit));
    g.translate(cx, cy); g.scale(k, k); g.translate(-focus[0], -focus[1]);
    fs = [cx, cy];
  } else if (io.enter != null && io.kind === 'surface' && io.from && io.from.focus) {
    const p = io.enter, f = io.from.focus;
    const k = lerp(0.04, 1, easeOut(p)), cx = lerp(f[0], W / 2, smooth(p)), cy = lerp(f[1], H / 2, smooth(p));
    g.translate(cx, cy); g.scale(k, k); g.translate(-W / 2, -H / 2);
  }
  fn();
  g.restore();
  return fs;
}
