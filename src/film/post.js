/* ===================================================================
   Compositor. Two scene layers (A = outgoing, B = incoming) and a mask
   layer come in; each layer gets its own look (CRT / SPACE / RISO), then
   the mask's red channel picks between them. All lengths are in LOGICAL
   px (u_scale converts), so 1080p and 4K look identical.
   Look params per layer: vec4 a = (curve, scan, aberr, persist)
                          vec4 b = (bloom, grain, vign, mode)  mode 0 crt, 1 space, 2 riso
   =================================================================== */
const COMP_FRAG = `
precision highp float;
varying vec2 v;
uniform sampler2D tA, tB, tM;
uniform sampler2D tA1, tA2, tB1, tB2;   // real gaussian blurs of each layer (quarter res), small + wide
uniform vec2 res;          // device px
uniform float u_scale;     // device px per logical px
uniform float time, mix_on;
uniform vec4 aA, bA, aB, bB;
uniform vec3 flash;        // global flash colour * amount
uniform sampler2D tR;      // riso background layer (ink channels)
uniform vec4 aR;
uniform float r_amt;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }

/* bloom from pre-blurred copies: smooth falloff, no discrete taps, so no ghost copies */
vec3 bloomOf(sampler2D s1, sampler2D s2, vec2 uv){
  vec3 c1 = texture2D(s1, uv).rgb, c2 = texture2D(s2, uv).rgb;
  return max(c1 - 0.35, 0.0) * 1.0 + max(c2 - 0.18, 0.0) * 0.7;
}

vec3 crtLook(sampler2D t, sampler2D s1, sampler2D s2, vec2 v0, vec4 a, vec4 b, out float inside){
  vec2 cc = v0 - 0.5;
  float r2 = dot(cc, cc);
  vec2 uv = 0.5 + cc * (1.0 + a.x * r2 * (1.0 + a.x * r2 * 0.6));
  inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  float ab = a.z * (0.3 + r2 * 2.2);
  vec3 col;
  col.r = texture2D(t, uv + cc * ab).r;
  col.g = texture2D(t, uv).g;
  col.b = texture2D(t, uv - cc * ab).b;
  col += bloomOf(s1, s2, uv) * b.x;
  /* scanlines at a fixed 540 logical rows, so 4K keeps the same density */
  float rows = 540.0;
  float sl = 1.0 - a.y * (0.5 + 0.5 * sin(uv.y * rows * 6.28318));
  float band = 1.0 + 0.045 * a.y * sin((uv.y * 2.0 - time * 0.31) * 6.28318);
  /* phosphor persistence: a soft halo (not an offset copy, which reads as a double image) */
  col = mix(col, max(col, texture2D(s1, uv).rgb * 0.9), a.w);
  col *= sl * band;
  float vig = 1.0 - b.z * pow(length(cc) * 1.5, 2.6);
  return col * vig * inside;
}

/* screened ink coverage only (x = pink, y = blue), for the faint riso background under A */
vec2 risoInks(sampler2D t, vec2 v0, vec4 a){
  vec2 px = v0 * res / u_scale, res_l = res / u_scale;
  vec2 oA = vec2(a.z, -a.z * 0.6), oB = vec2(-a.w * 0.8, a.w);
  float dA = texture2D(t, (px + oA) / res_l).r, dB = texture2D(t, (px + oB) / res_l).g;
  float cell = a.y, c = cos(0.2618), s = sin(0.2618), c2 = cos(1.3090), s2 = sin(1.3090);
  vec2 fA = fract(mat2(c,-s,s,c) * (px + oA) / cell) - 0.5, fB = fract(mat2(c2,-s2,s2,c2) * (px + oB) / cell) - 0.5;
  float e = 2.0 / cell;
  float sA = dA < 0.03 ? 0.0 : 1.0 - smoothstep(sqrt(dA) * 0.72 - e, sqrt(dA) * 0.72 + e, length(fA));
  float sB = dB < 0.03 ? 0.0 : 1.0 - smoothstep(sqrt(dB) * 0.72 - e, sqrt(dB) * 0.72 + e, length(fB));
  return vec2(sA, sB);
}

vec3 risoLook(sampler2D t, vec2 v0, vec4 a, vec4 b){
  /* channels are inks: R = pink density, G = blue density */
  vec2 px = v0 * res / u_scale;                         // logical px
  float wob = 0.6;
  vec2 oA = vec2(a.z, -a.z * 0.6) + vec2(sin(time*0.7), cos(time*0.5)) * wob;
  vec2 oB = vec2(-a.w * 0.8, a.w) + vec2(cos(time*0.6), sin(time*0.9)) * wob;
  vec2 res_l = res / u_scale;
  float dA = texture2D(t, (px + oA) / res_l).r;
  float dB = texture2D(t, (px + oB) / res_l).g;
  float cell = a.y;
  float sA, sB;
  {
    float c = cos(0.2618), s = sin(0.2618);
    vec2 q = mat2(c,-s,s,c) * (px + oA) / cell; vec2 f = fract(q) - 0.5;
    float r = sqrt(clamp(dA,0.,1.)) * 0.72, e = 0.5 / cell * 4.0;
    sA = dA < 0.03 ? 0.0 : dA > 0.93 ? 1.0 : 1.0 - smoothstep(r - e, r + e, length(f));
  }
  {
    float c = cos(1.3090), s = sin(1.3090);
    vec2 q = mat2(c,-s,s,c) * (px + oB) / cell; vec2 f = fract(q) - 0.5;
    float r = sqrt(clamp(dB,0.,1.)) * 0.72, e = 0.5 / cell * 4.0;
    sB = dB < 0.03 ? 0.0 : dB > 0.93 ? 1.0 : 1.0 - smoothstep(r - e, r + e, length(f));
  }
  vec3 paper = vec3(0.949, 0.925, 0.878);
  vec3 inkA = vec3(1.0, 0.282, 0.690), inkB = vec3(0.0, 0.47, 0.75);
  float takeA = 0.84 + 0.16 * vn(px / 180.0 + 3.1);
  float takeB = 0.82 + 0.18 * vn(px / 160.0 + 9.7);
  vec3 col = paper;
  col *= mix(vec3(1.0), inkA, sA * takeA);
  col *= mix(vec3(1.0), inkB, sB * takeB);
  col *= 1.0 - 0.10 * sA * sB;
  col -= vn(vec2(px.x / 3.0, px.y / 40.0)) * 0.035 + vn(px / 2.0 + time * 31.0) * 0.025;
  float vig = 1.0 - b.z * pow(length(v0 - 0.5) * 1.4, 2.0);
  return col * vig;
}

vec3 look(sampler2D t, sampler2D s1, sampler2D s2, vec2 v0, vec4 a, vec4 b){
  float inside = 1.0;
  if (b.w > 1.5) return risoLook(t, v0, a, b);
  return crtLook(t, s1, s2, v0, a, b, inside);
}

void main(){
  vec3 A = look(tA, tA1, tA2, v, aA, bA);
  vec3 col = A;
  if (mix_on > 0.5) {
    vec3 B = look(tB, tB1, tB2, v, aB, bB);
    vec4 m = texture2D(tM, v);
    col = mix(A, B, m.r);
    col += m.g * vec3(0.75, 1.0, 0.9) * 1.4;           // seam glow drawn into the mask
  }
  if (r_amt > 0.001) {
    /* the print shows only through the dark of the tube, so type stays clean */
    vec2 ink = risoInks(tR, v, aR);
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    vec3 bgc = vec3(1.0, 0.282, 0.690) * ink.x + vec3(0.0, 0.47, 0.75) * ink.y;
    col += bgc * r_amt * (1.0 - smoothstep(0.04, 0.3, lum));
  }
  col += flash;
  vec2 px = v * res / u_scale;
  float n = hash(floor(px * 1.0) + fract(time * 7.13) * 91.7);
  float gr = mix(bA.y, bB.y, mix_on > 0.5 ? texture2D(tM, v).r : 0.0);
  col += (n - 0.5) * gr;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function makeComp(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, mk(gl.VERTEX_SHADER, POST_VERT));
  gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, COMP_FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const texs = [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const tx = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx);
    for (const [k, val] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                            [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]])
      gl.texParameteri(gl.TEXTURE_2D, k, val);
    return tx;
  });
  const U = n => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('tA'), 0); gl.uniform1i(U('tB'), 1); gl.uniform1i(U('tM'), 2);
  gl.uniform1i(U('tA1'), 3); gl.uniform1i(U('tA2'), 4); gl.uniform1i(U('tB1'), 5); gl.uniform1i(U('tB2'), 6);
  gl.uniform1i(U('tR'), 7);
  const u = Object.fromEntries(['res', 'u_scale', 'time', 'mix_on', 'aA', 'bA', 'aB', 'bB', 'flash', 'aR', 'r_amt'].map(n => [n, U(n)]));
  const up = (i, src) => {
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texs[i]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  };
  /* gaussian blur copies at quarter res; radii in logical px (x S) so 4K matches 1080p */
  const BW = Math.ceil(canvas.width / 4), BH = Math.ceil(canvas.height / 4);
  const blurC = [0, 1, 2, 3].map(() => {
    const c = document.createElement('canvas'); c.width = BW; c.height = BH;
    return { c, g: c.getContext('2d') };
  });
  const blurInto = (b, src, r) => {
    b.g.filter = 'none'; b.g.clearRect(0, 0, BW, BH);
    b.g.filter = `blur(${(r * S / 4).toFixed(2)}px)`;
    b.g.drawImage(src, 0, 0, BW, BH);
    return b.c;
  };
  const vec = (lk) => [[lk.curve, lk.scan, lk.aberr, lk.persist], [lk.bloom, lk.grain, lk.vign, lk.mode]];
  return {
    draw(t, A, lookA, B, lookB, mask, flash = [0, 0, 0], bg = null) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(u.r_amt, bg ? bg.amt : 0);
      if (bg) { up(7, bg.c); gl.uniform4fv(u.aR, vec(LOOK.riso)[0]); }
      up(0, A);
      up(3, blurInto(blurC[0], A, 6)); up(4, blurInto(blurC[1], A, 26));
      const on = !!B;
      if (on) { up(1, B); up(2, mask); up(5, blurInto(blurC[2], B, 6)); up(6, blurInto(blurC[3], B, 26)); }
      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.u_scale, S);
      gl.uniform1f(u.time, t);
      gl.uniform1f(u.mix_on, on ? 1 : 0);
      const [a1, b1] = vec(lookA), [a2, b2] = vec(lookB || lookA);
      gl.uniform4fv(u.aA, a1); gl.uniform4fv(u.bA, b1);
      gl.uniform4fv(u.aB, a2); gl.uniform4fv(u.bB, b2);
      gl.uniform3fv(u.flash, flash);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    }
  };
}

/* ---------- the three looks ---------- */
const LOOK = {
  crt:   { curve: 0.11, scan: 0.14, aberr: 0.0010, persist: 0.0, bloom: 0.42, grain: 0.03, vign: 0.60, mode: 0 },
  space: { curve: 0.015, scan: 0.0, aberr: 0.0012, persist: 0.0, bloom: 1.0, grain: 0.032, vign: 0.48, mode: 1 },
  /* for riso: scan = halftone cell (logical px), aberr = drum A offset, persist = drum B offset */
  riso:  { curve: 0.0, scan: 6.5, aberr: 3.5, persist: 2.5, bloom: 0.0, grain: 0.02, vign: 0.18, mode: 2 },
};
const lookMix = (a, b, k) => Object.fromEntries(Object.keys(a).map(n => [n, n === 'mode' ? (k < 0.5 ? a.mode : b.mode) : lerp(a[n], b[n], k)]));
