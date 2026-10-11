/* ===================================================================
   Film core. Everything is drawn in LOGICAL 1920x1080 px; the canvases are
   sized to the viewport and scaled, so 1080p and 4K come from the same code.
   Shaders work in logical px too (see shaders.js). Pure function of t.
   =================================================================== */
const W = 1920, H = 1080;
/* ?w=2560&h=1440 pins the render size (play.html export); default = viewport (render.py) */
const _QS = new URLSearchParams(location.search);
const VW = +_QS.get('w') || Math.round(window.innerWidth), VH = +_QS.get('h') || Math.round(window.innerHeight);
const S = VW / W;                               // logical px -> device px
const BAR = 4 * BEAT;
const barTime = n => beatTime(4 * n);           // downbeat phase 0 (source/downbeat.py)

function layer() {
  const c = document.createElement('canvas');
  c.width = VW; c.height = VH;
  return { c, g: c.getContext('2d') };
}
const LAYERS = [layer(), layer()];
const MASK = layer();

function begin(L, fill = '#000') {
  const g = L.g;
  g.setTransform(S, 0, 0, S, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0; g.shadowColor = 'rgba(0,0,0,0)'; g.filter = 'none';
  g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([]);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = fill; g.fillRect(0, 0, W, H);
  return g;
}
/* shadowBlur is in device px and ignores the transform */
const BL = px => px * S;

/* ---------- small shared helpers ---------- */
const easeInOutQ = x => { x = clamp(x, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const pulse = (t, at, len) => (t < at || t > at + len) ? 0 : Math.exp(-(t - at) / (len * 0.3));
/* exponential decay since the most recent beat (0..1) */
function beatKick(t, every = 1, k = 9) {
  const b = beatAt(t) / every, f = b - Math.floor(b);
  return Math.exp(-f * every * BEAT * k);
}
function withAlpha(g, a, fn) { const s = g.globalAlpha; g.globalAlpha = s * a; fn(); g.globalAlpha = s; }

/* zoom the whole scene about a point (logical px) */
function zoomAbout(g, x, y, k) { g.translate(x, y); g.scale(k, k); g.translate(-x, -y); }

/* polyline helper */
function poly(g, pts, close = false) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) i ? g.lineTo(pts[i][0], pts[i][1]) : g.moveTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}

/* the lines of the song, plus small derived facts */
const LINES = window.LYRIC.lines;
for (const L of LINES) {
  L.latin = /^[A-Za-z ,.'!?]+$/.test(L.jp);
  L.first = (L.units.find(u => u.sung) || L.units[0]).t;
  L.last = [...L.units].reverse().find(u => u.sung).t;
}
/* when a line is on screen: from its first sung unit until the next line starts */
for (let i = 0; i < LINES.length; i++) {
  const L = LINES[i];
  const nx = LINES[i + 1];
  L.on = L.first - 0.04;
  L.off = nx ? nx.first - 0.04 : Math.min(L.end + 1.5, 275);
}
const lineAt = (i) => LINES[i];

/* ---------- audio features (source/audio_feat.py), 60 per second ---------- */
const AUDB = (() => {
  const A = window.AUD; if (!A) return null;
  const bin = atob(A.b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return { u, n: A.n, st: A.stride, fps: A.fps };
})();
/* ch: 0 rms, 1 low, 2 high, 3 onset, 4.. bands. Linear interpolation, 0..1 */
function aud(t, ch = 0) {
  if (!AUDB) return 0;
  const x = clamp(t * AUDB.fps, 0, AUDB.n - 1.001), i = Math.floor(x), f = x - i;
  return (AUDB.u[i * AUDB.st + ch] * (1 - f) + AUDB.u[(i + 1) * AUDB.st + ch] * f) / 255;
}
const band = (t, k) => aud(t, 4 + clamp(k | 0, 0, 31));
/* a smoothed envelope: mean over the last `win` seconds */
function audSm(t, ch = 0, win = 0.12) {
  let s = 0; const n = 6;
  for (let i = 0; i < n; i++) s += aud(t - win * i / n, ch);
  return s / n;
}
