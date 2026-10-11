/* ===================================================================
   Worldlines (plan C). z is time. The camera rides the chosen branch; the
   "present" frontier runs AHEAD of it. At every split the chosen line
   forks: one child stays chosen, the other leaves and keeps splitting for a
   few levels (a wavefunction of unobserved worlds) while DIVERGING, so old
   branches fly out of frame instead of piling up. Split directions turn by
   the golden angle. Everything is closed-form in t.
   cfg: t0, t1, V, ahead, splits (beat indices), spread, sub, seed, speed(t)
   =================================================================== */
const GOLD = Math.PI * (3 - Math.sqrt(5));
const FOC = (W / 2) / Math.tan(31 * Math.PI / 180);

function makeWorld(cfg) {
  const V = cfg.V ?? 420, AHEAD = cfg.ahead ?? 1000, T0 = cfg.t0, seed = cfg.seed ?? 1;
  const DT = 1 / 120, N = Math.ceil((cfg.t1 - T0 + 8) / DT);
  const Z = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) Z[i] = Z[i - 1] + V * (cfg.speed ? cfg.speed(T0 + (i - 0.5) * DT) : 1) * DT;
  const camZ = t => {
    const x = (t - T0) / DT;
    if (x <= 0) return V * (t - T0);
    if (x >= N) return Z[N] + V * (t - T0 - N * DT);
    const i = Math.floor(x); return Z[i] + (Z[i + 1] - Z[i]) * (x - i);
  };
  const frontier = t => camZ(t) + AHEAD;
  const splitT = cfg.splits.map(k => beatTime(k));
  const zS = splitT.map(frontier), MAXD = zS.length;
  const zSplit = d => zS[d - 1];
  let gap = 1e9; for (let i = 1; i < zS.length; i++) gap = Math.min(gap, zS[i] - zS[i - 1]);
  const SEG = Math.min(V * BEAT * 1.5, gap * 0.9);
  const R0 = cfg.spread ?? 130, SUB = cfg.sub ?? 3;
  const nodes = [{ id: 0, d: 0, parent: -1, x: 0, y: 0, chosen: true, kids: [], ph: 0, zdiv: -1e12 }];
  const ch = [nodes[0]];
  const add = n => { n.id = nodes.length; n.kids = []; nodes.push(n); nodes[n.parent].kids.push(n.id); return n; };
  function grow(p, d, rel) {                          // the unobserved subtree keeps splitting
    if (d > MAXD || rel > SUB) return;
    for (let c = 0; c < 2; c++) {
      const th = d * GOLD + c * Math.PI + (hash1(nodes.length * 31 + seed * 7) - 0.5) * 0.6;
      const k = add({ d, parent: p.id, chosen: false, dx: Math.cos(th), dy: Math.sin(th),
                      r: R0 * 0.62 * Math.pow(0.8, rel), ph: hash1(nodes.length * 131 + seed) * TAU, zdiv: p.zdiv });
      grow(k, d + 1, rel + 1);
    }
  }
  for (let d = 1; d <= MAXD; d++) {
    const p = ch[d - 1];
    const th = d * GOLD + (hash1(d * 7919 + seed * 31) - 0.5) * 0.8;
    const rc = R0 * 0.45;
    const c = add({ d, parent: p.id, chosen: true, x: p.x + rc * Math.cos(th), y: p.y + rc * Math.sin(th), ph: 0, zdiv: -1e12 });
    ch.push(c);
    const o = add({ d, parent: p.id, chosen: false, dx: Math.cos(th + Math.PI), dy: Math.sin(th + Math.PI),
                    r: R0, ph: hash1(d * 17 + seed) * TAU, zdiv: zSplit(d) });
    grow(o, d + 1, 1);
  }
  const zStart = n => n.d === 0 ? -1e12 : zSplit(n.d);
  const GROW = cfg.diverge ?? 1.15, CAP = cfg.cap ?? 6;
  /* a chosen node ends at the next split; an unobserved leaf ends once it has diverged out of frame */
  const zEnd = n => n.kids.length ? zSplit(n.d + 1) : n.chosen ? 1e12 : zSplit(n.d) + SEG * (CAP + 1.5);
  function pos(n, z) {
    const p = nodes[n.parent];
    if (n.chosen) {
      if (n.d === 0) return [0, 0];
      const k = smoothstep(zSplit(n.d), zSplit(n.d) + SEG, z);
      return [lerp(p.x, n.x, k), lerp(p.y, n.y, k)];
    }
    const a = p.chosen ? [p.x, p.y] : pos(p, z);
    const z0 = zSplit(n.d);
    const k = smoothstep(z0, z0 + SEG, z) + GROW * clamp((z - z0 - SEG) / SEG, 0, CAP);
    return [a[0] + n.dx * n.r * k, a[1] + n.dy * n.r * k];
  }
  function chosenAt(z) {
    let lo = 0, hi = MAXD;                            // last d with zSplit(d) <= z
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (zSplit(m) <= z) lo = m; else hi = m - 1; }
    return { n: ch[lo], p: pos(ch[lo], z) };
  }
  return { cfg, V, AHEAD, T0, camZ, frontier, nodes, ch, zStart, zEnd, pos, chosenAt, splitT, zSplit, MAXD, SEG };
}

/* split schedule helper: every `step` beats from t0 to t1 (beat indices) */
function splitsEvery(t0, t1, step = 2) {
  const out = [];
  for (let k = Math.ceil(beatAt(t0)); beatTime(k) <= t1; k += step) out.push(k);
  return out;
}

/* ---------- cameras ---------- */
function lookAt(C, T, roll = 0, zoom = 1) {
  let F = [T[0] - C[0], T[1] - C[1], T[2] - C[2]];
  const fl = Math.hypot(...F) || 1; F = F.map(v => v / fl);
  const up = Math.abs(F[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0];
  let R = [up[1] * F[2] - up[2] * F[1], up[2] * F[0] - up[0] * F[2], up[0] * F[1] - up[1] * F[0]];
  const rl = Math.hypot(...R) || 1; R = R.map(v => v / rl);
  const U = [F[1] * R[2] - F[2] * R[1], F[2] * R[0] - F[0] * R[2], F[0] * R[1] - F[1] * R[0]];
  const cr = Math.cos(roll), sr = Math.sin(roll);
  return { C, F, R: R.map((v, i) => v * cr + U[i] * sr), U: U.map((v, i) => v * cr - R[i] * sr), roll, foc: FOC * zoom };
}
/* the chase camera: just above and behind the chosen line, looking down it */
function chaseCT(Wd, t, o = {}) {
  const cz = Wd.camZ(t);
  const a = Wd.chosenAt(cz + 220).p, b = Wd.chosenAt(cz + 900).p;
  const off = o.offset || [46, 64];
  return { C: [a[0] + off[0], a[1] + off[1], cz], T: [b[0] - 10, b[1] + 6, cz + 900],
           roll: (o.roll ?? 0) + 0.06 * Math.sin(t * 0.45) + 0.03 * Math.sin(t * 1.3) };
}
function blendCT(A, B, k) {
  const L3 = (p, q) => p.map((v, i) => lerp(v, q[i], k));
  return { C: L3(A.C, B.C), T: L3(A.T, B.T), roll: lerp(A.roll, B.roll, k) };
}
const camOf = (ct, zoom = 1) => lookAt(ct.C, ct.T, ct.roll, zoom);
function proj(cam, x, y, z, near = 60) {
  const dx = x - cam.C[0], dy = y - cam.C[1], dz = z - cam.C[2];
  const zc = dx * cam.F[0] + dy * cam.F[1] + dz * cam.F[2];
  if (zc < near) return null;
  const xc = dx * cam.R[0] + dy * cam.R[1] + dz * cam.R[2];
  const yc = dx * cam.U[0] + dy * cam.U[1] + dz * cam.U[2];
  return { x: W / 2 + cam.foc * xc / zc, y: H / 2 - cam.foc * yc / zc, z: zc };
}
const STARS = Array.from({ length: 1400 }, (_, i) => {
  const u = hash1(i * 3 + 1) * 2 - 1, th = hash1(i * 3 + 2) * TAU, s = Math.sqrt(1 - u * u);
  return { v: [s * Math.cos(th), u, s * Math.sin(th) * 0.6 + 0.4], m: hash1(i * 3 + 3) };
});
function drawSky(g, t, cam, o = {}) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, o.top || '#02040a'); gr.addColorStop(0.55, o.mid || '#07112a'); gr.addColorStop(1, o.bot || '#03060f');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const streak = o.streak || 0;
  g.fillStyle = '#cfe4ff'; g.strokeStyle = '#cfe4ff';
  for (const s of STARS) {
    const zc = s.v[0] * cam.F[0] + s.v[1] * cam.F[1] + s.v[2] * cam.F[2];
    if (zc < 0.05) continue;
    const x = W / 2 + cam.foc * (s.v[0] * cam.R[0] + s.v[1] * cam.R[1] + s.v[2] * cam.R[2]) / zc;
    const y = H / 2 - cam.foc * (s.v[0] * cam.U[0] + s.v[1] * cam.U[1] + s.v[2] * cam.U[2]) / zc;
    if (x < -50 || x > W + 50 || y < -50 || y > H + 50) continue;
    const tw = 0.5 + 0.5 * Math.sin(t * (2 + s.m * 5) + s.m * 40);
    const a = (0.15 + 0.6 * s.m * s.m) * (0.6 + 0.4 * tw);
    const r = 1 + 1.6 * s.m * s.m;
    if (streak > 0.01) {
      const dx = x - W / 2, dy = y - H / 2;
      g.globalAlpha = a; g.lineWidth = r;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * streak * (0.3 + s.m), y + dy * streak * (0.3 + s.m)); g.stroke();
    } else { g.globalAlpha = a; g.fillRect(x, y, r, r); }
  }
  g.globalAlpha = 1;
}

/* the lines. o.conv 0..1 pulls every branch onto the chosen line (収束);
   o.wave scales the wavefunction shimmer; colours as "r,g,b" strings */
function drawWorldlines(g, Wd, t, cam, o = {}) {
  const fz = Wd.frontier(t), FAR = o.far || 4600, NEAR = 60;
  const cz = o.zmin != null ? o.zmin - NEAR - 10 : cam.C[2];
  const conv = o.conv || 0, waveAmp = o.wave ?? 1;
  const lim = o.from ?? -1e12;
  g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  const at = (n, z) => {
    let [x, y] = Wd.pos(n, z);
    if (conv > 0 && !n.chosen) { const c = Wd.chosenAt(z).p; x = lerp(x, c[0], conv); y = lerp(y, c[1], conv); }
    return [x, y];
  };
  for (const n of Wd.nodes) {
    const a = Math.max(Wd.zStart(n), cz + NEAR + 10, lim), b = Math.min(Wd.zEnd(n), fz, o.zmin != null ? fz : cz + FAR);
    if (b <= a) continue;
    const steps = clamp(Math.ceil((b - a) / (o.step || 34)), 2, 48);
    const col = n.chosen ? (o.chosenCol || '255,110,64') : (o.branchCol || '150,205,255');
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const z = lerp(a, b, i / steps);
      const [lx, ly] = at(n, z);
      const damp = 0.25 + 0.75 * smoothstep(200, 1400, z - cz);
      const amp = (n.chosen ? 1.0 : 3.4) * (1 + Math.min(n.d, 6) * 0.25) * damp * waveAmp * (1 - conv);
      const q = proj(cam, lx + amp * Math.sin(z * 0.013 - t * 5.2 + n.ph), ly + amp * Math.cos(z * 0.011 - t * 4.1 + n.ph * 1.3), z);
      if (q && prev) {
        const fog = 1 - smoothstep(1500, FAR, q.z), near = smoothstep(NEAR, NEAR + 160, q.z);
        const wpx = clamp(cam.foc * (n.chosen ? 6.5 : 2.6) * (o.thick || 1) / q.z, 0.7, 16);
        const al = (n.chosen ? 1 : 0.55 * (o.branchA ?? 1)) * fog * near;
        if (al > 0.004) {
          g.strokeStyle = `rgba(${col},${al * 0.16})`; g.lineWidth = wpx * 4;
          g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke();
          g.strokeStyle = `rgba(${col},${al})`; g.lineWidth = wpx;
          g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(q.x, q.y); g.stroke();
        }
      }
      prev = q;
    }
    if (fz > Wd.zStart(n) && fz <= Wd.zEnd(n) && !o.noHeads) {         // the writing head
      const [lx, ly] = at(n, fz);
      const q = proj(cam, lx, ly, fz);
      if (q) {
        const r = clamp(cam.foc * 14 / q.z, 2, 44) * (n.chosen ? 1.3 : 1);
        const rg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
        rg.addColorStop(0, n.chosen ? 'rgba(255,200,170,1)' : 'rgba(210,235,255,0.85)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg; g.fillRect(q.x - r * 3, q.y - r * 3, r * 6, r * 6);
      }
    }
  }
  for (let d = 1; d <= Wd.MAXD; d++) {                 // split flash, on the beat
    const dt = t - Wd.splitT[d - 1];
    if (dt < 0 || dt > 0.6) continue;
    const p = Wd.ch[d - 1], q = proj(cam, p.x, p.y, Wd.zSplit(d)); if (!q) continue;
    const r = cam.foc * (20 + 170 * easeOut(dt / 0.6)) / q.z;
    g.strokeStyle = `rgba(220,240,255,${0.75 * (1 - dt / 0.6)})`; g.lineWidth = 2;
    g.beginPath(); g.arc(q.x, q.y, r, 0, TAU); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
}

/* where the writing head of the chosen line is on screen (for transitions) */
function headOnScreen(Wd, t, cam) {
  const fz = Wd.frontier(t), p = Wd.chosenAt(fz).p;
  return proj(cam, p[0], p[1], fz);
}

/* a sung line written on the plane of the present, then left behind */
function worldLyric(g, Wd, L, t, cam, o = {}) {
  if (t < L.on) return;
  const zl = Wd.frontier(Math.min(t, L.last + 0.25)) - 60;
  const base = Wd.chosenAt(zl).p;
  const q = proj(cam, base[0] + (o.dx ?? -10), base[1] + (o.dy ?? 120), zl);
  if (!q) return;
  /* fade as the plane comes close (it is passing the camera), so it never fills the frame */
  const a = smoothstep(420, 780, q.z);
  if (a < 0.01) return;
  const k = cam.foc / q.z;
  const sz = (o.size || 150) * (Wd.AHEAD - 60) / FOC;
  g.save(); g.translate(q.x, q.y); g.rotate(cam.roll); g.scale(k, k);
  g.globalAlpha = a;
  drawLyric(g, L, t, Object.assign({ x: 0, y: 0, size: sz, maxW: 1560 * (Wd.AHEAD - 60) / FOC,
    color: '#f2f7ff', flash: 0.8, keep: true }, o.style || {}));
  g.restore();
}
