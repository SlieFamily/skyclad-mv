# -*- coding: utf-8 -*-
"""Render the full film: Playwright workers each render a contiguous frame range,
pipe PNG screenshots into ffmpeg (one segment per worker), then concat + mux the song.

Run:  python tools/render.py [--w 1920 --h 1080 --fps 30 --jobs 6 --out out/skyclad-observer_1080p30.mp4]
GPU:  python tools/render.py --w 2560 --h 1440 --fps 60 --jobs 6 --shot jpeg --encoder nvenc --crf 18 \
          --out out/skyclad-observer_1440p60.mp4
(WebGL already renders on the GPU via ANGLE/D3D11; --encoder nvenc moves video encoding to the GPU too.)
"""
import argparse, pathlib, subprocess, sys, time
from multiprocessing import Process, Queue
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
TMP = ROOT / "out" / "_seg"
LAUNCH = ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"]


def open_page(p, w, h):
    b = p.chromium.launch(args=LAUNCH)
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.goto((ROOT / "index.html").as_uri())
    pg.wait_for_function("window.ready === true || (window.ERRS && window.ERRS.length > 0)", timeout=120000)
    errs = pg.evaluate("window.ERRS || []")
    if errs:
        raise RuntimeError("page errors: " + "; ".join(map(str, errs)))
    return b, pg


def worker(k, f0, f1, a, q):
    seg = TMP / f"seg{k:02d}.mp4"
    codec = "mjpeg" if a.shot == "jpeg" else "png"
    if a.encoder == "nvenc":
        # GPU encode (NVIDIA). Consumer cards cap concurrent NVENC sessions (~8), keep --jobs <= 8.
        venc = ["-c:v", "h264_nvenc", "-preset", "p7", "-tune", "hq", "-rc", "vbr", "-cq", str(a.crf),
                "-b:v", "0", "-profile:v", "high"]
    else:
        venc = ["-c:v", "libx264", "-preset", a.preset, "-crf", str(a.crf)]
    enc = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(a.fps),
        "-c:v", codec, "-i", "-", *venc,
        "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
        str(seg)], stdin=subprocess.PIPE)
    shot = {"type": "jpeg", "quality": a.quality} if a.shot == "jpeg" else {"type": "png"}
    with sync_playwright() as p:
        b, pg = open_page(p, a.w, a.h)
        for i in range(f0, f1):
            r = pg.evaluate("t => { try { window.render(t); return null } catch (e) { return String(e.stack || e) } }", i / a.fps)
            if r:
                q.put(("err", k, f"frame {i}: {r.splitlines()[0]}"))
            enc.stdin.write(pg.screenshot(**shot))
            if (i - f0) % 30 == 0:
                q.put(("prog", k, i - f0))
        b.close()
    enc.stdin.close(); enc.wait()
    q.put(("done", k, f1 - f0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--w", type=int, default=1920); ap.add_argument("--h", type=int, default=1080)
    ap.add_argument("--fps", type=int, default=30); ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--out", default="out/skyclad-observer_1080p30.mp4")
    ap.add_argument("--shot", choices=["png", "jpeg"], default="png", help="frame capture format (jpeg is ~2x faster at 4K)")
    ap.add_argument("--quality", type=int, default=95, help="jpeg capture quality")
    ap.add_argument("--crf", type=int, default=14, help="x264 CRF / NVENC CQ")
    ap.add_argument("--preset", default="slow", help="x264 preset (ignored for nvenc)")
    ap.add_argument("--encoder", choices=["x264", "nvenc"], default="x264", help="nvenc = NVIDIA GPU encode")
    a = ap.parse_args()
    TMP.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b, pg = open_page(p, 640, 360)
        dur = pg.evaluate("window.FILM.duration"); b.close()
    n = round(dur * a.fps)
    cuts = [round(n * j / a.jobs) for j in range(a.jobs + 1)]
    print(f"duration {dur:.3f}s -> {n} frames, {a.jobs} workers", flush=True)
    q = Queue()
    ps = [Process(target=worker, args=(k, cuts[k], cuts[k + 1], a, q)) for k in range(a.jobs)]
    for pr in ps: pr.start()
    prog, done, errs, t0 = [0] * a.jobs, 0, 0, time.time()
    while done < a.jobs:
        kind, k, v = q.get()
        if kind == "err":
            errs += 1; print(v, flush=True)
        elif kind == "prog":
            prog[k] = v
            s = sum(prog); el = time.time() - t0
            if k == 0:
                print(f"{s}/{n} frames  {el:.0f}s elapsed  ~{el / max(s, 1) * (n - s):.0f}s left", flush=True)
        else:
            done += 1; prog[k] = v
    for pr in ps: pr.join()
    if any(pr.exitcode for pr in ps):
        sys.exit("a worker failed")
    lst = TMP / "list.txt"
    lst.write_text("".join(f"file 'seg{k:02d}.mp4'\n" for k in range(a.jobs)))
    out = ROOT / a.out
    # no -shortest: it trimmed the last frames when the audio ended a hair early
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-i", str(ROOT / "source" / "music.flac"), "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-movflags", "+faststart",
                    str(out)], check=True)
    print(f"wrote {out}  ({errs} frame errors, {time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
