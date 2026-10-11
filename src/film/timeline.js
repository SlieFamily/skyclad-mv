/* ===================================================================
   Timeline. Scenes in order; between each pair a transition centred at
   `at` lasting `len`. Inside a transition both scenes draw (outgoing into
   layer 0, incoming into layer 1), the outgoing scene reports a focus point,
   and the mask decides who is visible where:
     dive     A -> C   the CRT zooms into its phosphor dot; the dot opens
     surface  C -> A   the writing head shrinks into a CRT dot; the tube grows out of it
     gate     C -> B   a door frame rushes at the camera; the print is inside it
     scan     B -> *   an electron beam sweeps down, rewriting the page
   =================================================================== */
const TRANS = {
  dive:    { len: 0.9 },
  surface: { len: 0.9 },
  gate:    { len: 0.8 },
  scan:    { len: 0.62 },
  hard:    { len: 0.001 },   // a straight cut
};

/* SCENES and CUTS are filled by the scene files: register(kind, fn, look) */
const SCENES = [];
/* o.bg: t -> amount of the faint riso print behind the scene (0 = none) */
function scene(id, look, draw, o = {}) { const s = { id, look, draw, bg: o.bg }; SCENES.push(s); return s; }
/* the same scene object again (a scene resumed after an insert) */
function again(s) { SCENES.push(s); }
/* cut list: [time, kind] between SCENES[i] and SCENES[i+1] */
let CUTS = [];

function maskDraw(kind, p, focus, t) {
  const g = begin(MASK, '#000');
  g.globalCompositeOperation = 'lighter';
  const f = focus || [W / 2, H / 2];
  const far = Math.hypot(Math.max(f[0], W - f[0]), Math.max(f[1], H - f[1]));
  if (kind === 'dive' || kind === 'surface') {
    /* the opening: starts as the dot, ends past the corners */
    const e = kind === 'dive' ? easeIn(smoothstep(0.25, 1, p)) : easeInOut(smoothstep(0.0, 0.8, p));
    const r = lerp(0, far * 1.05, e);
    if (r > 0.5) {
      g.fillStyle = 'rgb(255,0,0)';
      g.beginPath(); g.arc(f[0], f[1], r, 0, TAU); g.fill();
      g.strokeStyle = `rgba(0,255,0,${0.65 * (1 - e)})`; g.lineWidth = 3 + 14 * (1 - e);
      g.beginPath(); g.arc(f[0], f[1], r, 0, TAU); g.stroke();
    }
  } else if (kind === 'gate') {
    const R = GATE_RECT;          // filled by the C scene while it draws the door
    if (R) {
      g.fillStyle = 'rgb(255,0,0)'; g.fillRect(R.x, R.y, R.w, R.h);
    }
  } else if (kind === 'hard') {
    if (p >= 0.5) { g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, 0, W, H); }
  } else if (kind === 'scan') {
    const y = lerp(-40, H + 40, easeInOut(p));
    g.fillStyle = 'rgb(255,0,0)'; g.fillRect(0, 0, W, Math.max(0, y));
    const lg = g.createLinearGradient(0, y - 90, 0, y + 6);
    lg.addColorStop(0, 'rgba(0,255,0,0)'); lg.addColorStop(0.85, 'rgba(0,255,0,0.35)'); lg.addColorStop(1, 'rgba(0,255,0,0.9)');
    g.fillStyle = lg; g.fillRect(0, y - 90, W, 96);
  }
  return MASK.c;
}
let GATE_RECT = null;

let COMP = null;
function renderFilm(t) {
  /* which cut window are we in, if any */
  let i = 0;
  while (i < CUTS.length && t >= CUTS[i][0] + TRANS[CUTS[i][1]].len / 2) i++;
  const cut = CUTS[i];
  const inWin = cut && t >= cut[0] - TRANS[cut[1]].len / 2;
  const bgOf = (sc) => (sc && sc.bg ? sc.bg(t) : 0);
  const withBg = (amt) => {
    if (amt <= 0.002) return null;
    bgPrint(begin(BGL), t);
    return { c: BGL.c, amt };
  };
  if (!inWin) {
    const sc = SCENES[i];
    const g = begin(LAYERS[0]);
    sc.draw(g, t, {});
    COMP.draw(t, LAYERS[0].c, LOOK[sc.look], null, null, null, undefined, withBg(bgOf(sc)));
    return;
  }
  const [at, kind] = cut, len = TRANS[kind].len;
  const p = clamp((t - (at - len / 2)) / len, 0, 1);
  const A = SCENES[i], B = SCENES[i + 1];
  GATE_RECT = null;
  const gA = begin(LAYERS[0]);
  const ra = A.draw(gA, t, { exit: p, kind }) || {};
  const gB = begin(LAYERS[1]);
  B.draw(gB, t, { enter: p, kind, from: ra });
  const m = maskDraw(kind, p, ra.focus, t);
  COMP.draw(t, LAYERS[0].c, LOOK[A.look], LAYERS[1].c, LOOK[B.look], m, undefined,
            withBg(lerp(bgOf(A), bgOf(B), p)));
}
const BGL = layer();

/* the active scene's local io for a time (used by stills) */
function sceneAt(t) {
  let i = 0;
  while (i < CUTS.length && t >= CUTS[i][0]) i++;
  return SCENES[i];
}
