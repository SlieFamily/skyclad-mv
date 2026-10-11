/* ===================================================================
   The film: scene list + cut list. Times are song seconds.
   =================================================================== */

/* ---------- C extras ---------- */
function blackHole(g, t, cam, Wd, s) {
  if (s <= 0.002) return;
  const z = Wd.camZ(t) + 5200, c = Wd.chosenAt(z).p;
  const q = proj(cam, c[0] + 40, c[1] + 160, z); if (!q) return;
  const R = cam.foc * 520 * s / q.z;
  g.save();
  /* the glow of the disk behind the shadow */
  const rg = g.createRadialGradient(q.x, q.y, R * 0.8, q.x, q.y, R * 4.2);
  rg.addColorStop(0, `rgba(255,170,110,${0.55 * s})`); rg.addColorStop(0.35, `rgba(200,80,40,${0.18 * s})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(q.x - R * 4.2, q.y - R * 4.2, R * 8.4, R * 8.4);
  /* the accretion disk, tilted, Doppler-bright on the approaching side */
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 26; k++) {
    const rr = R * (1.5 + k * 0.09), a0 = t * (1.6 - k * 0.03);
    for (let j = 0; j < 48; j++) {
      const th = a0 + j / 48 * TAU, dop = 0.5 + 0.5 * Math.cos(th);
      g.strokeStyle = `rgba(255,${150 + 80 * dop | 0},${90 + 120 * dop | 0},${(0.05 + 0.22 * dop * dop) * s * (1 - k / 26)})`;
      g.lineWidth = Math.max(1, R * 0.05);
      g.beginPath(); g.ellipse(q.x, q.y, rr, rr * 0.26, -0.18, th, th + TAU / 48 + 0.01); g.stroke();
    }
  }
  /* the far side of the disk, lensed up over the top of the shadow */
  g.strokeStyle = `rgba(255,210,170,${0.55 * s})`; g.lineWidth = Math.max(1.5, R * 0.08);
  g.beginPath(); g.ellipse(q.x, q.y - R * 0.12, R * 1.25, R * 1.12, -0.18, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#000'; g.beginPath(); g.arc(q.x, q.y, R, 0, TAU); g.fill();
  g.strokeStyle = `rgba(255,235,210,${0.9 * s})`; g.lineWidth = Math.max(1.5, R * 0.035);
  g.shadowColor = '#ffd2a0'; g.shadowBlur = BL(18);
  g.beginPath(); g.arc(q.x, q.y, R * 1.04, 0, TAU); g.stroke();
  g.restore();
}
/* memory pulses racing ahead along the chosen line, one per 8th note */
function pulses(g, t, cam, Wd, t0, t1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const k1 = Math.floor(beatAt(t) * 2);
  for (let k = k1; k > k1 - 6; k--) {
    const tb = beatTime(k / 2); if (tb < t0 || tb > t1) continue;
    const z = Wd.camZ(tb) + 120 + (t - tb) * 2600;
    if (z > Wd.frontier(t)) continue;
    const c = Wd.chosenAt(z).p, q = proj(cam, c[0], c[1], z); if (!q) continue;
    const r = clamp(cam.foc * 30 / q.z, 3, 90);
    const rg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 3);
    rg.addColorStop(0, 'rgba(255,240,220,0.95)'); rg.addColorStop(0.3, 'rgba(255,130,80,0.5)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(q.x - r * 3, q.y - r * 3, r * 6, r * 6);
  }
  g.restore();
}
function eyeOverlay(g, t, L, col) {
  const a = 1 - smoothstep(L.last + 0.3, L.off + 0.4, t);
  if (t < L.first - 0.05 || a <= 0) return;
  g.save(); g.globalAlpha = a * 0.9; vectorEye(g, t, L.first, W / 2, H / 2 - 30, 210, col); g.restore();
}

CUTS = CUT_LIST;
for (let i = 1; i < CUTS.length; i++) if (CUTS[i][0] <= CUTS[i - 1][0]) throw new Error(`cut ${i} out of order: ${CUTS[i][0]}`);
if (SCENES.length !== CUTS.length + 1) throw new Error(`scenes ${SCENES.length} vs cuts ${CUTS.length}`);

/* ---------- page contract ---------- */
const OUT = document.getElementById('out');
OUT.width = VW; OUT.height = VH;
COMP = makeComp(OUT);
window.render = t => renderFilm(t);
window.FILM = { duration: 274.591, scenes: SCENES.map(s => s.id), cuts: CUTS };
document.fonts.ready.then(() => { window.render(0); window.ready = true; });
