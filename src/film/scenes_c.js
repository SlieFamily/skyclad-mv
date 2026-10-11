/* ===================================================================
   Plan C scenes: the worldline flight. One builder, six instances.
   spec: t0, t1, lines (indices), splits, formulas [{name, at, side}],
         cam(t, base) -> ct override, extra(g, t, cam, Wd), sky opts, style
   Enter from A (dive): the flight is already running; the mask opens.
   Exit to A (surface): the camera pulls back so the chosen writing head
   shrinks to a dot; that dot becomes the CRT dot.
   Exit to B (gate): a door frame stands on the line ahead and rushes in.
   =================================================================== */
const C_STYLE = {
  colorOf: (q) => q.f === 'gothic' ? '#ffd9c8' : q.f === 'ud' ? '#cfe8ff' : q.f === 'slab' ? '#ffb347' : '#f2f7ff',
  glow: 0.10, flash: 0.85,
};

function cScene(spec) {
  const Wd = makeWorld({ t0: spec.t0 - 1.5, t1: spec.t1 + 2, V: spec.V ?? 420, ahead: 1000, seed: spec.seed ?? 3,
                         splits: spec.splits, spread: spec.spread ?? 130, sub: spec.sub ?? 3, speed: spec.speed,
                         diverge: spec.diverge, cap: spec.cap });
  const lines = spec.lines.map(i => LINES[i]);
  spec.W = Wd;
  return (g, t, io) => {
    let ct = chaseCT(Wd, t, spec.camOpt || {});
    if (spec.cam) ct = spec.cam(t, ct, Wd) || ct;
    let zoom = spec.zoom ? spec.zoom(t) : 1;
    /* surfacing: pull the camera back and narrow the lens, so the head becomes a dot */
    let surf = 0;
    if (io.exit != null && io.kind === 'surface') {
      surf = easeInOut(io.exit);
      const fz = Wd.frontier(t), hp = Wd.chosenAt(fz).p;
      ct = blendCT(ct, { C: [hp[0] + 30, hp[1] + 40, fz - 5200], T: [hp[0], hp[1], fz], roll: 0 }, surf);
      zoom = lerp(zoom, 0.55, surf);
    }
    const cam = camOf(ct, zoom);
    drawSky(g, t, cam, Object.assign({}, spec.sky ? spec.sky(t) : {}));
    if (spec.under) spec.under(g, t, cam, Wd);
    drawWorldlines(g, Wd, t, cam, Object.assign({ branchA: 1 - 0.7 * surf }, spec.wl ? spec.wl(t) : {}));
    /* formulas: road signs of the multiverse, standing beside the line */
    for (const f of spec.formulas || []) {
      if (t < f.at) continue;
      const zf = Wd.frontier(f.at) - 200, base = Wd.chosenAt(zf).p;
      const q = proj(cam, base[0] + (f.side ?? -1) * 300, base[1] + (f.up ?? 250), zf);
      if (!q) continue;
      const a = smoothstep(120, 520, q.z) * (1 - surf);
      if (a < 0.01) continue;
      drawTex(g, f.name, q.x, q.y, cam.foc * (f.h ?? 60) / q.z,
              { color: f.color || '#bfe0ff', alpha: a * 0.92, reveal: smoothstep(f.at, f.at + 0.7, t), tags: f.tags });
    }
    for (const L of lines) {
      if (t < L.on || t > L.off + 4) continue;
      const st = typeof spec.style === 'function' ? spec.style(t) : spec.style;
      worldLyric(g, Wd, L, t, cam, { size: spec.size ?? 150, dy: spec.dy ?? 120, style: Object.assign({}, C_STYLE, st || {}) });
    }
    if (spec.extra) spec.extra(g, t, cam, Wd, io);
    const out = {};
    if (io.exit != null && io.kind === 'surface') {
      const h = headOnScreen(Wd, t, cam);
      out.focus = h ? [h.x, h.y] : [W / 2, H / 2];
      /* the head's glow grows into the phosphor dot */
      if (h) phosDot(g, h.x, h.y, lerp(6, 14, surf), surf, '#ffffff');
    }
    if (io.exit != null && io.kind === 'gate') out.focus = drawGate(g, t, io.exit, cam, Wd);
    return out;
  };
}

/* the gate: a door frame on the chosen line, ahead of the camera, rushing in.
   Its inner rectangle is the mask: the print shows through it. */
function drawGate(g, t, p, cam, Wd) {
  const e = easeIn(p);
  const cz = Wd.camZ(t);
  const zd = cz + lerp(4000, 60, e);
  const c = Wd.chosenAt(zd).p;
  const hw = 260, hh = 340;
  const pts = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => proj(cam, c[0] + x, c[1] + 60 + y, zd, 5));
  if (pts.some(q => !q)) { GATE_RECT = { x: 0, y: 0, w: W, h: H }; return [W / 2, H / 2]; }
  const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
  const R = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  GATE_RECT = R;
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.strokeStyle = 'rgba(255,72,176,0.95)'; g.lineWidth = Math.max(3, R.w * 0.02);
  g.shadowColor = '#ff48b0'; g.shadowBlur = BL(30);
  g.strokeRect(R.x, R.y, R.w, R.h);
  g.strokeStyle = 'rgba(0,140,230,0.8)'; g.lineWidth = Math.max(2, R.w * 0.008);
  g.strokeRect(R.x - R.w * 0.04, R.y - R.h * 0.03, R.w * 1.08, R.h * 1.06);
  g.restore();
  return [R.x + R.w / 2, R.y + R.h / 2];
}

/* entering a C scene from A: nothing special to draw, the dive mask opens on it */
