/* ===================================================================
   Shot list. A (CRT) carries the film; C (worldline flight) opens with the
   title and returns for chorus 2a, the bridge time-tree and final chorus b.
   =================================================================== */
const CUT_LIST = [];
const snapB = t => beatTime(Math.round(beatAt(t)));
/* append a scene after a cut */
function cutTo(at, kind, s) { CUT_LIST.push([at, kind]); SCENES.push(s); return s; }
const mk = (id, look, draw, o = {}) => ({ id, look, draw, bg: o.bg });

/* 0 — 24.61  C: title + credits */
SCENES.push(mk('C-title', 'space', cTitle()));

/* 24.61 — 54.79  A: verse 1 — six staged shots, one per line */
cutTo(24.61, 'surface', mk('A-verse1', 'crt', aVerse1v3()));

/* 54.79 — 61.97  A: the gate (quantum circuit on the scope) */
cutTo(54.79, 'dive', mk('A-gate1', 'crt', aGate({ t0: 54.79, head: 'THE GATE', gate: 7, kisei: 8, open: 9, results: [0, 1, 1] })));

/* 61.97 — 71.49  A: chorus 1a */
cutTo(61.97, 'hard', mk('A-chorus1a', 'crt', aChorusA({ zero: 10, now: 11, logic: 12 })));

/* 71.49 — 84.97  A: chorus 1b — eye, parallel traces, 存在 */
cutTo(71.49, 'hard', mk('A-chorus1b', 'crt', aChorus1bv3()));

/* 84.97 — 91.30  A: convergence on the scope */
cutTo(84.97, 'hard', mk('A-converge1', 'crt', aConverge({ keshiki: 16, shusoku: 17 })));

/* 91.30 — 123.41  A: interlude + verse 2a */
cutTo(91.30, 'hard', mk('A-interlude', 'crt', aInterlude({ t0: 91.30 })));

/* 123.41 — 141.01  A: verse 2b — four staged shots */
cutTo(123.41, 'hard', mk('A-verse2b', 'crt', aVerse2bv3()));

/* 141.01 — 148.20  A: gate 2 */
cutTo(141.01, 'hard', mk('A-gate2', 'crt', aGate({ t0: 141.01, head: 'THE GATE, CLOSED', gate: 24, kisei: 25, open: 26, results: [1, 0, 1] })));

/* 148.20 — 157.40  C: chorus 2a (light-speed) */
const SPEED2 = t => 1 + 2.4 * easeInOut(smoothstep(148.3, 150.4, t)) - 1.6 * easeInOut(smoothstep(152.8, 154.2, t));
cutTo(148.20, 'dive', mk('C-chorus2a', 'space', cScene({
  t0: 147.6, t1: 158.0, seed: 41, speed: SPEED2,
  lines: [27, 28, 29],
  splits: splitsEvery(148.0, 158.0, 2),
  formulas: [{ name: 'dilation', at: 149.6, side: 1 }, { name: 'energy', at: 151.4, side: -1 }, { name: 'fourier', at: 153.4, side: 1 }],
  sky: t => ({ streak: 0.35 * (SPEED2(t) - 1) }),
  extra: (g, t, cam, Wd) => pulses(g, t, cam, Wd, 151.2, 153.4),
})));

/* 157.40 — 176.94  A: chorus 2b */
cutTo(157.40, 'surface', mk('A-chorus2b', 'crt', aChorus2b({})));

/* 176.94 — 208.00  C: the bridge — the worldline tree */
const WIDE = t => easeInOut(smoothstep(177.3, 181.8, t));
const CONV = t => easeInOut(smoothstep(203.9, 206.9, t));
cutTo(176.94, 'dive', mk('C-bridge', 'space', cScene({
  t0: 176.34, t1: 208.6, seed: 53, V: 380,
  lines: [36, 37], size: 380, dy: 220,
  splits: splitsEvery(176.64, 203.9, 2),
  diverge: 0.9, cap: 9,
  cam: (t, ct, Wd) => {
    const w = WIDE(t); if (w <= 0) return ct;
    const fz = Wd.frontier(t), hp = Wd.chosenAt(fz).p, a = (t - 177) * 0.045;
    const wide = { C: [hp[0] + 1500 * Math.sin(a), hp[1] + 820, fz - 3300 - 900 * Math.cos(a)], T: [hp[0], hp[1] + 60, fz - 300], roll: 0.04 * Math.sin(t * 0.3) };
    return blendCT(ct, wide, w);
  },
  wl: t => ({ conv: CONV(t), wave: 1 + 2.6 * smoothstep(198.9, 200.4, t) * (1 - CONV(t)), far: 9500, branchA: 1 }),
  formulas: [
    { name: 'everett', at: 180.2, side: 1, h: 300, up: 420 }, { name: 'superpos', at: 190.6, side: -1, h: 300, up: 420 },
    { name: 'schrod', at: 196.2, side: 1, h: 300, up: 420 }, { name: 'collapse', at: 204.6, side: -1, h: 320, up: 420, tags: { 1: '#ffb347' } },
  ],
  extra: (g, t, cam, Wd) => {
    const L = LINES[36]; if (t < L.first || t > L.off + 1) return;
    const a = smoothstep(L.first, L.first + 0.4, t) * (1 - smoothstep(L.off, L.off + 1, t));
    const cz = cam.C[2] + 900, p0 = Wd.chosenAt(cz).p, q0 = proj(cam, p0[0], p0[1] - 120, cz);
    const h = headOnScreen(Wd, t, cam);
    if (q0) drawTex(g, 'ket0', q0.x, q0.y + 70, 120, { color: '#ffb347', alpha: a, glow: BL(16) });
    if (h) drawTex(g, 'ket1', h.x + 40, h.y + 90, 120, { color: '#ffb347', alpha: a * smoothstep(188.0, 188.4, t), glow: BL(16) });
  },
})));

/* 208.00 — 217.60  A: final chorus a */
cutTo(208.00, 'surface', mk('A-chorus-final-a', 'crt', aChorusA({ zero: 38, now: 39, logic: 40 })));

/* 217.60 — 231.00  C: final chorus b */
cutTo(217.60, 'dive', mk('C-chorus-final-b', 'space', cScene({
  t0: 217.0, t1: 231.6, seed: 67, V: 600,
  lines: [41, 42, 43],
  splits: [...splitsEvery(217.3, 219.6, 2), ...splitsEvery(219.7, 223.8, 1), ...splitsEvery(224.4, 231.6, 2)],
  formulas: [{ name: 'everett', at: 221.9, side: 1, h: 64 }, { name: 'born', at: 226.4, side: -1 }],
  sky: t => ({ mid: '#1a0712', bot: '#0a0306' }),
  extra: (g, t, cam, Wd) => eyeOverlay(g, t, LINES[41], '#ffb0a0'),
  style: { colorOf: (q) => q.f === 'gothic' ? '#ff9a80' : q.f === 'ud' ? '#ffd0e0' : q.f === 'slab' ? '#ffb347' : '#fff0ec' },
  wl: t => {
    const L = LINES[43];
    const fl = t > L.first + 0.4 && t < L.off && hash1(Math.floor(t * 15) * 11 + 5) < 0.4;
    return { chosenCol: fl ? '200,170,255' : '255,60,48', branchCol: '255,170,200', wave: 1.4 };
  },
})));

/* 231.00 — end  A: the finale */
const FINALE = aFinale({});
cutTo(231.00, 'surface', mk('A-finale', 'crt', (g, t, io) => { const r = FINALE(g, t, io); powerOff(g, t, 271.2); return r; }));
