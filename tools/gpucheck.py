# -*- coding: utf-8 -*-
"""Which GPU path does headless Chromium actually use for WebGL?
SwiftShader = CPU fallback (slow); ANGLE (D3D11) on the NVIDIA card = what we want.

Run:  python tools/gpucheck.py
"""
import time
from playwright.sync_api import sync_playwright

JS = """() => {
  const c = document.createElement('canvas'); c.width = 1920; c.height = 1080;
  const gl = c.getContext('webgl2');
  if (!gl) return {err: 'no webgl2'};
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const fl = !!gl.getExtension('EXT_color_buffer_float');
  // crude fill-rate test: 200 full-screen passes of a heavy fragment shader
  const vs = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const fs = `#version 300 es
precision highp float; out vec4 o; uniform float k;
void main(){ vec2 u = gl_FragCoord.xy/1080.; float a = 0.;
  for (int i = 0; i < 64; i++) a += sin(u.x*float(i)+k)*cos(u.y*float(i)-k);
  o = vec4(a*0.01); }`;
  const mk = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
  const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) { gl.uniform1f(gl.getUniformLocation(pr, 'k'), i); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return {renderer: r, floatFBO: fl, ms_per_pass: ((performance.now() - t0) / 200).toFixed(2)};
}"""

VARIANTS = {
    "render.py default": ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
    "angle d3d11":       ["--enable-gpu", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=d3d11"],
    "angle d3d11 + gpu rasterization": ["--enable-gpu", "--ignore-gpu-blocklist", "--use-gl=angle",
                                        "--use-angle=d3d11", "--enable-gpu-rasterization", "--enable-zero-copy"],
}

with sync_playwright() as p:
    for name, args in VARIANTS.items():
        try:
            b = p.chromium.launch(headless=True, args=args)
            pg = b.new_page()
            pg.goto("about:blank")
            print(f"{name:34s} {pg.evaluate(JS)}")
            b.close()
        except Exception as e:
            print(f"{name:34s} FAILED {str(e).splitlines()[0]}")
