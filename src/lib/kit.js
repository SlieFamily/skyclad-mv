/* Shared tools for the preview pages and the finished film.
   Everything here is a pure function of t — no timers, no unseeded randomness. */

const TAU = Math.PI * 2;

/* ---------- math ---------- */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, x) => a + (b - a) * x;
const inv = (a, b, x) => b === a ? 0 : clamp((x - a) / (b - a), 0, 1);
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function smoothstep(a, b, x) { return smooth(inv(a, b, x)); }
const easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
const easeIn = x => Math.pow(clamp(x, 0, 1), 3);

/* Closed-form spring: value moves toward a target that changes at known times.
   Never reads the previous frame, so frame 812 renders correctly on its own. */
function spring(x, w = 16, z = 0.72) {
  if (x <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}
/* a value that retargets several times, evaluated at absolute time t */
function springSeq(t, keys, w = 16, z = 0.72) {
  let v = 0;
  for (let i = 0; i < keys.length; i++) {
    if (t < keys[i][0]) break;
    const prev = i === 0 ? 0 : keys[i - 1][1];
    v += (keys[i][1] - prev) * spring(t - keys[i][0], w, z);
  }
  return v;
}

/* seeded pseudo-random: same seed -> same number, always */
function hash1(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
function rnd(seed) { return hash1(Math.floor(seed * 1000) | 0); }
function rndRange(seed, a, b) { return a + (b - a) * rnd(seed); }

/* deterministic 2D value noise, used for grain and hand-drawn jitter */
function vnoise(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const h = (a, b) => hash1(Math.imul(a, 374761393) + Math.imul(b, 668265263) + seed);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}

/* ---------- colour ---------- */
function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgba(h, a = 1) { const c = hex(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function mixc(h1, h2, x) {
  const a = hex(h1), b = hex(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], x))},${Math.round(lerp(a[1], b[1], x))},${Math.round(lerp(a[2], b[2], x))})`;
}

/* ---------- canvas helpers ---------- */
class Pad {
  constructor(w, h, scale = 1) {
    this.c = document.createElement('canvas');
    this.c.width = Math.round(w * scale); this.c.height = Math.round(h * scale);
    this.g = this.c.getContext('2d');
    this.g.scale(scale, scale);
    this.w = w; this.h = h; this.scale = scale;
  }
  clear() { this.g.clearRect(0, 0, this.w, this.h); }
  image(sx, sy, sw, sh, alpha = 1, composite = 'source-over') {
    const g = this.ctx; g.globalAlpha = alpha; g.globalCompositeOperation = composite;
    g.drawImage(this.c, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
}

function glowText(g, text, x, y, size, color, blur, weight = 700, family = 'serif') {
  g.save();
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = blur;
  g.fillStyle = color;
  g.fillText(text, x, y);
  g.fillText(text, x, y);
  g.restore();
}

/* ---------- type taxonomy ----------
   Verified on this machine with src/facecheck.py: these six Japanese stacks all
   resolve to DIFFERENT glyph shapes (hashed raster comparison), so typeface can
   carry meaning instead of being decoration. Each voice in the lyric gets one:

     mincho   Yu Mincho     — 教義. The slow serif of scripture: 神, 世界, 絶対.
     gothic   Yu Gothic     — 観測者. Heavy sans, the mind asserting itself.
     ud       BIZ UDPMincho — 教材. Universal-design serif: readable, neutral, declarative.
     meiryo   Meiryo        — 順応. Soft, human, the everyday register.
     msgoth   MS Gothic     — 機械. Terminal output, counters, logic gates.
     slab     Arial Black   — 数字. The ０ and １, blunt and monumental.
     mono     Consolas      — 計器. Read-outs, timestamps, formulas-in-code.
     latin    Times New Roman — 数式. Physics and mathematics proper.
   --------------------------------------------------------------------------- */
const FONT_STACKS = {
  mincho: '"Yu Mincho","YuMincho","MS PMincho",serif',
  gothic: '"Yu Gothic UI","Yu Gothic","Meiryo",sans-serif',
  ud:     '"BIZ UDPMincho","BIZ UDMincho",serif',
  meiryo: '"Meiryo","Yu Gothic",sans-serif',
  msgoth: '"MS Gothic","MS PGothic",monospace',
  slab:   '"Arial Black","Impact",sans-serif',
  mono:   '"Consolas","Courier New",monospace',
  latin:  '"Times New Roman",Times,serif',
};
/* the six distinct Japanese faces, for tests and contact sheets */
const JP_FACES = ['mincho', 'gothic', 'ud', 'meiryo', 'msgoth', 'slab'];

/* ---------- WebGL post ----------
   One full-screen pass: bloom, chromatic aberration, barrel distortion,
   scanlines with a rolling refresh band, phosphor persistence, grain, vignette. */
const POST_VERT = `
attribute vec2 p; varying vec2 v; void main(){ v = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const POST_FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D tex;
uniform vec2 res;
uniform float time;
uniform float bloom, aberr, curve, scan, grain, vign, persist, exposure, mask;

void main(){
  vec2 uv = v;
  /* barrel distortion — the glass of the tube */
  vec2 cc = uv - 0.5;
  float r2 = dot(cc, cc);
  uv = 0.5 + cc * (1.0 + curve * r2 * (1.0 + curve * r2 * 0.6));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
  vec2 texel = 1.0 / res;

  /* chromatic aberration grows toward the edge of the tube */
  float ab = aberr * (0.25 + r2 * 2.2);
  vec3 col;
  col.r = texture2D(tex, uv + cc*ab).r;
  col.g = texture2D(tex, uv).g;
  col.b = texture2D(tex, uv - cc*ab).b;

  /* cheap separable bloom: two crossed 9-tap blurs on the bright pass */
  vec3 bl = vec3(0.0); float wsum = 0.0;
  for (int i = -4; i <= 4; i++){
    float w = 1.0 - abs(float(i))/5.0;
    vec3 a = texture2D(tex, uv + vec2(float(i),0.0)*texel*4.0).rgb;
    vec3 b = texture2D(tex, uv + vec2(0.0,float(i))*texel*4.0).rgb;
    bl += (max(a-0.55,0.0) + max(b-0.55,0.0)) * w; wsum += w*2.0;
  }
  bl = (bl/wsum) * bloom;

  /* scanlines + a slow rolling refresh band */
  float sl = 1.0 - scan * 0.5 * (0.5 + 0.5*sin(uv.y*res.y*3.14159));
  float band = 1.0 + 0.05 * sin((uv.y*3.0 - time*0.35)*3.14159);
  float grille = 1.0 - mask * (0.5 + 0.5*sin(uv.x*res.x*3.14159));

  vec3 outc = (col + bl) * sl * band * grille * exposure;

  /* phosphor persistence: a faint ghost of the previous field, one line up */
  vec3 ghost = texture2D(tex, uv + vec2(0.0, texel.y*1.5)).rgb;
  outc = mix(outc, max(outc, ghost*0.55), persist);

  /* grain, driven by the frame time so it never repeats within a shot */
  float n = fract(sin(dot(uv*res + time*137.0, vec2(12.9898,78.233)))*43758.5453);
  outc += (n - 0.5) * grain;

  float vig = 1.0 - vign * pow(length(cc)*1.55, 2.4);
  outc *= vig;
  gl_FragColor = vec4(outc, 1.0);
}`;

function makePost(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, POST_VERT));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, POST_FRAG));
  gl.linkProgram(prog); gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  const U = {};
  for (const n of ['res', 'time', 'bloom', 'aberr', 'curve', 'scan', 'grain', 'vign', 'persist', 'exposure', 'mask'])
    U[n] = gl.getUniformLocation(prog, n);

  return {
    gl, canvas,
    draw(source, t, opt = {}) {
      const W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform2f(U.res, W, H);
      gl.uniform1f(U.time, t);
      gl.uniform1f(U.bloom, opt.bloom ?? 0.55);
      gl.uniform1f(U.aberr, opt.aberr ?? 0.0016);
      gl.uniform1f(U.curve, opt.curve ?? 0.10);
      gl.uniform1f(U.scan, opt.scan ?? 0.22);
      gl.uniform1f(U.grain, opt.grain ?? 0.045);
      gl.uniform1f(U.vign, opt.vign ?? 0.55);
      gl.uniform1f(U.persist, opt.persist ?? 0.18);
      gl.uniform1f(U.exposure, opt.exposure ?? 1.12);
      gl.uniform1f(U.mask, opt.mask ?? 0.10);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    }
  };
}

/* ---------- time helpers ---------- */
/* musical grid, measured to the sample by source/tempo.py (167.000 BPM).
   48 kHz / 30 fps = exactly 1600 samples per frame, so every beat is an exact
   sample index and every cut can be expressed as an integer sample. */
const GRID = (window.LYRIC && window.LYRIC.grid) || { sr: 48000, bpm: 167, beat_period_samples: 17245.509, first_beat_sample: 8400, downbeat_index_offset: 3 };
const SR = GRID.sr;
const BPM = GRID.bpm;
const BEAT = GRID.beat_period_samples / SR;
const BEAT0 = GRID.first_beat_sample / SR;          // time of beat 0
const beatTime = k => (GRID.first_beat_sample + k * GRID.beat_period_samples) / SR;
const beatAt = t => (t - BEAT0) / BEAT;              // fractional beat index
const isDownbeat = k => ((k - GRID.downbeat_index_offset) % 4 + 4) % 4 === 0;
const bar = n => n * 4 * BEAT;
function beatPhase(t) { const b = beatAt(t); return b - Math.floor(b); }
/* which beat index a time falls on */
function beatIdx(t) { return Math.round(beatAt(t)); }
